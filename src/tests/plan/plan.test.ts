import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "../../db/client";
import { setupUser, createCaller, createAuthenticatedCaller } from "../helpers/utils";
import { eq } from "drizzle-orm";
import { trpcError } from "../../trpc/core";
import resetDb from "../helpers/resetDb";

describe("plans routes", async () => {
    beforeAll(async () => {
        await resetDb();
    });
    describe("create plan", async () => {
        const user = {
            email: "mail@mail.com",
            password: "P@ssw0rd",
            name: "test",
            timezone: "Asia/Riyadh",
            locale: "en",
            isAdmin: true,
        };
        let userInDb
        beforeAll(async () => {
            await createCaller({}).auth.register(user);
            userInDb = await db.query.users.findFirst({
                where: eq(schema.users.email, user.email),
            });
            await db.update(schema.users)
                .set({ isAdmin: true })
                .where(eq(schema.users.id, 1));
        });
        const plan = {
            name: "plan 1",
            price: 5
        }
        it("should create plan successfully", async () => {
            const createdPlanRes = await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).plans.create(plan);
            expect(createdPlanRes.success).toBe(true);

            const planInDb = await db.query.plans.findFirst({
                where: eq(schema.plans.name, plan.name),
            });
            expect(planInDb).toBeDefined();
            expect(planInDb!.name).toBe(plan.name);
            expect(planInDb!.id).toBeDefined();
            expect(planInDb!.createdAt).toBeDefined();
            expect(planInDb!.updatedAt).toBeDefined();
            expect(planInDb!.price).toBe(plan.price);
        });

        it("error on duplicate plan", async () => {
            await expect(createAuthenticatedCaller({
                userId: userInDb!.id,
            }).plans.create(plan)).rejects.toThrowError(
                new trpcError({
                    code: "BAD_REQUEST",
                })
            );
        });
    });

    describe("update plan", async () => {
        const user = {
            email: "mail@mail.com",
            password: "P@ssw0rd",
            name: "test",
            timezone: "Asia/Riyadh",
            locale: "en",
            isAdmin: true,
        };
        const userInDb = await db.query.users.findFirst({
            where: eq(schema.users.email, user.email),
        });
        it("should update plan successfully", async () => {
            const newPlan = {
                id: 1,
                name: "updated plan 1",
                price: 10
            }
            const updatedPlanRes = await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).plans.update(newPlan);

            expect(updatedPlanRes.success).toBe(true);

            const planInDb = await db.query.plans.findFirst({
                where: eq(schema.plans.id, newPlan.id),
            });
            expect(planInDb).toBeDefined();
            expect(planInDb!.name).toBe(newPlan.name);
            expect(planInDb!.price).toBe(newPlan.price);
        });

        it("plan not found error", async () => {
            const newPlan = {
                id: 2,
                name: "updated plan 1",
                price: 10
            }
            await expect(createAuthenticatedCaller({
                userId: userInDb!.id,
            }).plans.update(newPlan)).rejects.toThrowError(
                new trpcError({
                    code: "BAD_REQUEST",
                })
            );

        });
    });

    describe("get plans", async () => {
        const user = {
            email: "mail@mail.com",
            password: "P@ssw0rd",
            name: "test",
            timezone: "Asia/Riyadh",
            locale: "en",
            isAdmin: true,
        };
        const userInDb = await db.query.users.findFirst({
            where: eq(schema.users.email, user.email),
        });

        beforeAll(async () => {
            const plan = {
                name: "plan 2",
                price: 10
            }
            await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).plans.create(plan);
        });

        it("should get plan successfully", async () => {
            const pagination = {
                page: 1,
                size: 10
            }
            const getPlanRes = await createCaller({
            }).plans.get(pagination);

            const planInDb = await db.query.plans.findMany({});
            expect(getPlanRes.plans).toBeDefined();
            for (let i = 0; i < getPlanRes.plans.length; i++) {
                expect(planInDb[i]!.name).toBe(getPlanRes!.plans[i]!.name);
                expect(planInDb[i]!.id).toBe(getPlanRes!.plans[i]!.id);
                expect(planInDb[i]!.price).toBe(getPlanRes!.plans[i]!.price);
            }
        });
    });
});
