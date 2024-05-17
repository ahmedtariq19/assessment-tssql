import { db, schema } from "../../../db/client";
import { and, eq, gte } from "drizzle-orm";
import { schedule } from 'node-cron';

// Cron job to check subscription end time every minute
schedule('* * * * *', async() => {
    // get subscription activation which are ended
    const nowTime = new Date()
    // get all active subscriptions
    const subscriptions = await db.query.subscriptions.findMany({
        where:eq(schema.subscriptions.status, "ACTIVE")
    });

    for (const elem of subscriptions){
        // check subscriptions activation record
        const subscriptionsActivation = await db.query.subscriptionActivations.findFirst({
            where:eq(schema.subscriptionActivations.subscriptionId, elem.id)
        });
        if (!subscriptionsActivation) {
            continue
        }
        if (subscriptionsActivation.endAt>=nowTime) {
            // mark subscription as inactive
            await db.update(schema.subscriptions)
                .set({status:"INACTIVE" })
                .where(eq(schema.subscriptions.id, elem.id));

            // get plan again , there's chance that plan price changed
            const plan = await db.query.plans.findFirst({
                where:eq(schema.plans.id, elem.planId)
            });
            if (!plan) {
                continue
            }

            const order = await db.query.orders.findFirst({
                where:eq(schema.orders.subscriptionId, elem.id)
            });
            if (!order) {
                continue
            }

            // create new order for user
            const [createdOrder] = await db
                .insert(schema.orders)
                .values({
                createdAt: new Date(),
                updatedAt: new Date(),
                subscriptionId:elem.id,
                userId:order.userId,
                amount:plan.price,
                status:"UNPAID",
            })
            .returning();
        }
    }
});