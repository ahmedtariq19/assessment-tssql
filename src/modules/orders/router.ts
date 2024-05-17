import { router, trpcError, publicProcedure, protectedProcedure } from "../../trpc/core";
import { z } from "zod";
import { db, schema } from "../../db/client";
import { and, eq } from "drizzle-orm";


export const orders = router({
  create: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
        status: z.string(),
      })
    )
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { subscriptionId, status } = input;
      // check subscription 
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId)
      });
      if (!subscription) {
        throw new trpcError({
          code: "BAD_REQUEST",
        });
      }
      const plan = await db.query.plans.findFirst({
        where: eq(schema.plans.id, subscription.planId)
      });
      if (!plan) {
        throw new trpcError({
          code: "BAD_REQUEST",
        });
      }

      if (status == "PAID") {
        // create new order
        const [createdOrder] = await db
          .insert(schema.orders)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            subscriptionId: subscriptionId,
            userId: userId,
            amount: plan.price,
            status: "PAID",
          })
          .returning();
        await db.update(schema.subscriptions)
          .set({
            status: "ACTIVE",
          })
          .where(eq(schema.subscriptions.id, subscriptionId));

        const subscriptionStart = new Date()
        const subscriptionEnd = new Date()
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
        const [createdActication] = await db
          .insert(schema.subscriptionActivations)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            subscriptionId: subscriptionId,
            startAt: subscriptionStart,
            endAt: subscriptionEnd
          })
          .returning();
      } else {
        // create new order
        const [createdOrder] = await db
          .insert(schema.orders)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            subscriptionId: subscriptionId,
            userId: userId,
            amount: plan.price,
            status: "UNPAID",
          })
          .returning();
      }

      return {
        success: true,
      };

    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string(), price: z.number(), }))
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { id, name, price } = input;
      try {
        // check is user is admin user
        const user = await db.query.users.findFirst({
          where: and(eq(schema.users.id, userId), eq(schema.users.isAdmin, true))
        });
        if (!user) {
          throw new trpcError({
            code: "BAD_REQUEST",
          });
        }
        db.update(schema.plans)
          .set({
            name,
            price
          })
          .where(eq(schema.plans.id, id));
        return {
          success: true,
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
        };
      }
    }),
});
