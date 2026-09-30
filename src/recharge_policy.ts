import { z } from "zod";

export const paymentEventSchema = z.discriminatedUnion("type", [
  z.object({
    event_id: z.string().min(1),
    type: z.literal("balance_observed"),
    occurred_at: z.string().datetime(),
    balance: z.number().nonnegative(),
    risk: z.enum(["normal", "elevated", "restricted"])
  }),
  z.object({
    event_id: z.string().min(1),
    type: z.literal("recharge_fired"),
    occurred_at: z.string().datetime(),
    balance: z.number().nonnegative(),
    recharge_amount: z.number().positive(),
    risk: z.enum(["normal", "elevated", "restricted"]),
    notify: z.string().email()
  })
]);

export type PaymentEvent = z.infer<typeof paymentEventSchema>;
export type Risk = PaymentEvent["risk"];

export type RechargePolicy = {
  trigger_balance: number;
  recharge_amount: number;
};

export function rechargePolicyFor(risk: Risk): RechargePolicy | null {
  if (risk === "restricted") return null;
  if (risk === "elevated") {
    return { trigger_balance: 20, recharge_amount: 50 };
  }
  return { trigger_balance: 25, recharge_amount: 100 };
}

export type EventDecision =
  | { action: "configure_recharge"; policy: RechargePolicy }
  | { action: "notify_recharge" }
  | { action: "review_required" }
  | { action: "balance_healthy" };

export function decidePaymentAction(event: PaymentEvent): EventDecision {
  if (event.type === "recharge_fired") return { action: "notify_recharge" };
  const policy = rechargePolicyFor(event.risk);
  if (!policy) return { action: "review_required" };
  if (event.balance <= policy.trigger_balance) {
    return { action: "configure_recharge", policy };
  }
  return { action: "balance_healthy" };
}
