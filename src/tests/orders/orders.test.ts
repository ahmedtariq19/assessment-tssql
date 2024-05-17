import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "../../db/client";
import { setupUser, createCaller, createAuthenticatedCaller } from "../helpers/utils";
import { eq } from "drizzle-orm";
import { trpcError } from "../../trpc/core";
import resetDb from "../helpers/resetDb";

describe("orders routes", async () => {
    beforeAll(async () => {
        await resetDb();
    });
    describe("create order", async () => {
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

            const subscription = {
                planId: 1,
                teamId: 1
            }

            await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).subscriptions.create(subscription);

            await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).subscriptions.create(subscription);
        });


        it("should create unpaid order successfully", async () => {
            const order = {
                subscriptionId:1,
                status:"UNPAID"
            }
            const createdOrderRes = await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).orders.create(order);
            expect(createdOrderRes.success).toBe(true);

            const orderInDb = await db.query.orders.findFirst({
                where: eq(schema.orders.subscriptionId, order.subscriptionId),
            });

            const subscriptionInDb = await db.query.subscriptions.findFirst({
                where: eq(schema.subscriptions.id, order.subscriptionId),
            });

            const subscriptionActivationInDb = await db.query.subscriptionActivations.findFirst({
                where: eq(schema.subscriptionActivations.subscriptionId, order.subscriptionId),
            });

            expect(orderInDb).toBeDefined();
            expect(orderInDb!.status).toBe(order.status);
            expect(subscriptionInDb!.status).toBe("INACTIVE");
            expect(orderInDb!.id).toBeDefined();
            expect(subscriptionActivationInDb).toBeUndefined();
            expect(orderInDb!.createdAt).toBeDefined();
            expect(orderInDb!.updatedAt).toBeDefined();
        });

        it("should create paid order successfully", async () => {
            const order = {
                subscriptionId:2,
                status:"PAID"
            }
            const createdOrderRes = await createAuthenticatedCaller({
                userId: userInDb!.id,
            }).orders.create(order);
            expect(createdOrderRes.success).toBe(true);

            const orderInDb = await db.query.orders.findFirst({
                where: eq(schema.orders.subscriptionId, order.subscriptionId),
            });

            const subscriptionInDb = await db.query.subscriptions.findFirst({
                where: eq(schema.subscriptions.id, order.subscriptionId),
            });

            const subscriptionActivationInDb = await db.query.subscriptionActivations.findFirst({
                where: eq(schema.subscriptionActivations.subscriptionId, order.subscriptionId),
            });
            expect(orderInDb).toBeDefined();
            expect(subscriptionActivationInDb).toBeDefined();
            expect(orderInDb!.status).toBe(order.status);
            expect(subscriptionInDb!.status).toBe("ACTIVE");
            expect(orderInDb!.id).toBeDefined();
            expect(orderInDb!.createdAt).toBeDefined();
            expect(orderInDb!.updatedAt).toBeDefined();
        });


        it("subscription not found", async () => {
            const order = {
                subscriptionId:4,
                status:"PAID"
            }

            await expect(createAuthenticatedCaller({
                userId: userInDb!.id,
            }).orders.create(order)).rejects.toThrowError(
                new trpcError({
                    code: "BAD_REQUEST",
                })
            );;
        });
    });
});
