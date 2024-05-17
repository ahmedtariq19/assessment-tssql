import { router, trpcError, publicProcedure, protectedProcedure } from "../../trpc/core";
import { z } from "zod";
import { db, schema } from "../../db/client";
import { and, eq } from "drizzle-orm";
import { log } from "console";


export const plans = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        price: z.number(),
      })
    )
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { name, price } = input;

      // check is user is admin user
      const adminUser = await db.query.users.findFirst({
        where: and(eq(schema.users.id, userId), eq(schema.users.isAdmin, true))
      });
      if (!adminUser) {
        throw new trpcError({
          code: "BAD_REQUEST",
        });
      }
      // check if plan already exist
      const plan = await db.query.plans.findFirst({
        where: eq(schema.plans.name, name),
      });
      // check 400
      if (plan) {
        throw new trpcError({
          code: "BAD_REQUEST",
        });
      }

      // create new plan
      const [createdPlan] = await db
        .insert(schema.plans)
        .values({
          createdAt: new Date(),
          updatedAt: new Date(),
          name,
          price
        })
        .returning();
      return {
        success: true,
      };

    }),
  get: publicProcedure.input(z.object({ page: z.number(), size: z.number() })).query(async ({ input }) => {
    const { page, size } = input;
    try {
      const skip = (page - 1) * size;
      const plans = await db.query.plans.findMany({
        offset: skip,
        limit: size,
      });

      return {
        plans: plans
      };
    } catch (error) {
      console.error("Error fetching plans", error);
      return {
        plans: []
      };
    }
  }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string(), price: z.number(), }))
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { id, name, price } = input;

      // check is user is admin user
      const adminUser = await db.query.users.findFirst({
        where: and(eq(schema.users.id, userId), eq(schema.users.isAdmin, true))
      });
      if (!adminUser) {
        throw new trpcError({
          code: "BAD_REQUEST",
        });
      }

      const plan = await db.query.plans.findFirst({
        where: eq(schema.plans.id, id)
      });
      if (!plan) {
        throw new trpcError({
          code: "BAD_REQUEST",
        });
      }
      await db.update(schema.plans)
        .set({
          name,
          price
        })
        .where(eq(schema.plans.id, id));
      return {
        success: true,
      };
    }),
});
