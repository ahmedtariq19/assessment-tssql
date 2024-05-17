import { router, trpcError, publicProcedure, protectedProcedure } from "../../trpc/core";
import { z } from "zod";
import { db, schema } from "../../db/client";
import { and, eq } from "drizzle-orm";


export const subscriptions = router({
  create: protectedProcedure
    .input(
      z.object({
        planId: z.number(),
        teamId: z.number(),
      })
    )
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { planId, teamId } = input;
      try {
        // check is plan if does not exist throw bad request
        const plan = await db.query.plans.findFirst({
          where: eq(schema.plans.id, planId)
        });
        if (!plan) {
          throw new trpcError({
            code: "BAD_REQUEST",
          });
        }

        // check is team if does not exist throw bad request
        const team = await db.query.teams.findFirst({
          where: eq(schema.teams.id, teamId)
        });
        if (!team) {
          throw new trpcError({
            code: "BAD_REQUEST",
          });
        }

        // create new subscription
        const [createdSubscription] = await db
          .insert(schema.subscriptions)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            planId: planId,
            teamId: teamId,
            status: "INACTIVE"
          })
          .returning();
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
  upgrade: protectedProcedure
    .input(
      z.object({
        planId: z.number(),
        subscriptionId: z.number(),
      })
    )
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { planId, subscriptionId } = input;
        // check is plan if does not exist throw bad request
        
        const plan = await db.query.plans.findFirst({
          where: eq(schema.plans.id, planId)
        });
        if (!plan) {
          throw new trpcError({
            code: "BAD_REQUEST",
          });
        }

        // check if subscription if does not exist throw bad request
        const subscription = await db.query.subscriptions.findFirst({
          where: eq(schema.subscriptions.id, subscriptionId)
        });
        if (!subscription) {
          throw new trpcError({
            code: "BAD_REQUEST",
          });
        }

        // get subscription activation record and check for remaining days
        const subscriptionsActivation = await db.query.subscriptionActivations.findFirst({
          where: eq(schema.subscriptionActivations.subscriptionId, subscriptionId)
        });

        if (!subscriptionsActivation) {
          throw new trpcError({
            code: "BAD_REQUEST",
          });
        }

        // get subscription order
        const order = await db.query.orders.findFirst({
          where: eq(schema.orders.subscriptionId, subscriptionId)
        });

        if (!order) {
          throw new trpcError({
            code: "BAD_REQUEST",
          });
        }

        // get user team
        const team = await db.query.teams.findFirst({
          where: eq(schema.teams.userId, userId)
        });
        if (!team) {
          throw new trpcError({
            code: "BAD_REQUEST",
          });
        }

        const nowTime = new Date()

        // calculate remaning days
        const timeDifference = nowTime.getTime() - subscriptionsActivation.startAt.getTime();
        
        // Convert milliseconds to days
        const consumedDays = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

        // calculate amount per day consider plan for a month
        const amountPerDay = order.amount / 30

        // calculate amount comsumed
        const comsumedAmount = consumedDays * amountPerDay

        // remaining amount
        const remainingAmount = order.amount - comsumedAmount

        // calculate new plan amount 
        const planAmount = Number((plan.price - remainingAmount).toFixed(2));


        // create new subscription
        const [createdSubscription] = await db
          .insert(schema.subscriptions)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            planId: planId,
            teamId: team.id,
            status: "INACTIVE"
          })
          .returning();

        // make previous subscription inactive
        await db.update(schema.subscriptions)
          .set({ status: "INACTIVE" })
          .where(eq(schema.subscriptions.id, subscription.id));

        // create new order
        const [createdOrder] = await db
          .insert(schema.orders)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            subscriptionId: createdSubscription!.id,
            userId: userId,
            amount: planAmount,
            status: "UNPAID",
          })
          .returning();

        return {
          success: true,
        };
      
      
    }),
});
