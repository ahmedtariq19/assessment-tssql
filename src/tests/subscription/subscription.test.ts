import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "../../db/client";
import { setupUser, createCaller, createAuthenticatedCaller } from "../helpers/utils";
import { eq } from "drizzle-orm";
import { trpcError } from "../../trpc/core";
import resetDb from "../helpers/resetDb";

describe("subscription routes", async () => {
    beforeAll(async () => {
        await resetDb();
    });
    describe("create subscription", async () => {
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
            await db.update(schema.users)
                .set({ isAdmin: true })
                .where(eq(schema.users.id, 1));
            userInDb = await db.query.users.findFirst({
                where: eq(schema.users.email, user.email),
            });
            const plan = {
                name: "plan 1",
                price: 5
            }
            await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).plans.create(plan);

            const team = {
                name: "team 1",
            }
            await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).teams.create(team);
        });


        it("should create subscription successfully", async () => {
            const subscription = {
                planId: 1,
                teamId: 1
            }

            const createdSubscriptionRes = await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).subscriptions.create(subscription);
            expect(createdSubscriptionRes.success).toBe(true);

            const subscriptionInDb = await db.query.subscriptions.findFirst({
                where: eq(schema.subscriptions.teamId, subscription.teamId),
            });
            expect(subscriptionInDb).toBeDefined();
            expect(subscriptionInDb!.id).toBeDefined();
            expect(subscriptionInDb!.createdAt).toBeDefined();
            expect(subscriptionInDb!.updatedAt).toBeDefined();
            expect(subscriptionInDb!.teamId).toBe(subscription.teamId);
        });

        it("plan not found", async () => {
            const subscription = {
                planId: 2,
                teamId: 1
            }

            const createdSubscriptionRes = await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).subscriptions.create(subscription);
            expect(createdSubscriptionRes.success).toBe(false);
        });

        it("team not found", async () => {
            const subscription = {
                planId: 1,
                teamId: 2
            }

            const createdSubscriptionRes = await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).subscriptions.create(subscription);
            expect(createdSubscriptionRes.success).toBe(false);
        });
    });

    describe("upgrade subscription", async () => {
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

            const subscriptionStart = new Date()
            const subscriptionEnd = new Date()
            subscriptionStart.setHours(subscriptionStart.getHours() - 240)
            subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
            await db
                .insert(schema.subscriptionActivations)
                .values({
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    subscriptionId: 1,
                    startAt: subscriptionStart,
                    endAt: subscriptionEnd
                })
            await db
                .insert(schema.orders)
                .values({
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    subscriptionId: 1,
                    userId: userInDb!.id,
                    amount: 5,
                    status: "PAID",
                })
        });


        it("should upgrade subscription successfully", async () => {
            const subscription = {
                planId: 2,
                subscriptionId: 1
            }

            const upgratedSubscriptionRes = await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).subscriptions.upgrade(subscription);
            expect(upgratedSubscriptionRes.success).toBe(true);

            const subscriptionInDb = await db.query.subscriptions.findFirst({
                where: eq(schema.subscriptions.id, subscription.subscriptionId),
            });
            const newOrderInDb = await db.query.orders.findFirst({
                where: eq(schema.orders.subscriptionId,2),
            });
            const oldOrderInDb = await db.query.orders.findFirst({
                where: eq(schema.orders.subscriptionId,1),
            });
            const newSubscriptionInDb = await db.query.subscriptions.findFirst({
                where: eq(schema.subscriptions.id, 2),
            });
            expect(newSubscriptionInDb).toBeDefined();
            expect(newOrderInDb).toBeDefined();
            expect(newSubscriptionInDb!.planId).toBe(subscription.planId);
            expect(newOrderInDb!.id).toBe(2);
            expect(newOrderInDb!.status).toBe("UNPAID");
            expect(newSubscriptionInDb!.planId).toBe(subscription.planId);
            expect(newSubscriptionInDb!.id).toBeDefined();
            expect(newSubscriptionInDb!.createdAt).toBeDefined();
            expect(newSubscriptionInDb!.updatedAt).toBeDefined();
        });

        it("plan not found", async () => {
            const subscription = {
                planId: 3,
                subscriptionId: 1
            }

            await expect(createAuthenticatedCaller({
                userId: userInDb!.id,
            }).subscriptions.upgrade(subscription)).rejects.toThrowError(
                new trpcError({
                    code: "BAD_REQUEST",
                })
            );
        });


        it("subscription not found", async () => {
            const subscription = {
                planId: 2,
                subscriptionId: 4
            }

            await expect(createAuthenticatedCaller({
                userId: userInDb!.id,
            }).subscriptions.upgrade(subscription)).rejects.toThrowError(
                new trpcError({
                    code: "BAD_REQUEST",
                })
            );
        });
    });
});
