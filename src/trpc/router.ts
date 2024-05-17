import { router } from "./core";

import { auth } from "../modules/auth/router";
import { account } from "../modules/users/router";
import { teams } from "../modules/teams/router";
import { plans } from "../modules/plans/router";
import { orders } from "../modules/orders/router";
import { subscriptions } from "../modules/subscription/router";

export const appRouter = router({
  auth,
  // protected
  account,
  teams,
  plans,
  orders,
  subscriptions,
});

export type AppRouter = typeof appRouter;
