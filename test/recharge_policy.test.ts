import assert from "node:assert/strict";
import test from "node:test";
import { decidePaymentAction, paymentEventSchema } from "../src/recharge_policy.ts";

test("an elevated-risk low balance selects a smaller recharge", () => {
  const event = paymentEventSchema.parse({
    event_id: "evt_2026_09_28_001",
    type: "balance_observed",
    occurred_at: "2026-09-28T08:30:00.000Z",
    balance: 12,
    risk: "elevated"
  });

  assert.deepEqual(decidePaymentAction(event), {
    action: "configure_recharge",
    policy: { trigger_balance: 20, recharge_amount: 50 }
  });
});

test("a restricted account is held for review", () => {
  const event = paymentEventSchema.parse({
    event_id: "evt_2026_09_28_002",
    type: "balance_observed",
    occurred_at: "2026-09-28T08:31:00.000Z",
    balance: 4,
    risk: "restricted"
  });

  assert.deepEqual(decidePaymentAction(event), { action: "review_required" });
});
