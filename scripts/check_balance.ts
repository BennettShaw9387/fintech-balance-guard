import { InfraiClient } from "../src/infrai_client.ts";
import { rechargePolicyFor } from "../src/recharge_policy.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before checking the balance");

const client = new InfraiClient(key);
const account = await client.getBalance();
const policy = rechargePolicyFor("normal");

if (policy && account.balance <= policy.trigger_balance) {
  await client.configureAutoRecharge(policy);
  console.log(JSON.stringify({ balance: account.balance, action: "configure_recharge", policy }, null, 2));
} else {
  console.log(JSON.stringify({ balance: account.balance, action: "balance_healthy" }, null, 2));
}
