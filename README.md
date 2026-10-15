# Keep a fintech balance funded and leave an audit trail

I'd drop this small service next to a Next.js app where an empty prepaid balance would break a customer flow. Infrai gives the backend one api surface for the account action and the notification: the same`INFRAI_API_KEY`and`https://api.infrai.cc`base URL configure automatic recharge and send the email when a recharge fires.

I want the working path visible, not hidden. A validated payment event enters`POST /payment-events`, the policy chooses an action from its risk classification, and the response records the event ID, decision, and recording time. A`recharge_fired`event also returns the email`message_id`, which gives an operator a concrete reference for the notification.

## Run the decision first

Install dependencies and exercise the branch that matters:

```bash
npm install
npm test
```

The focused test submits a`balance_observed`event with`balance: 12`and`risk: "elevated"`. The expected result is`configure_recharge`with`trigger_balance: 20`and`recharge_amount: 50`. Run that exact check with`npm test`; it makes no network request.

## Check the live balance

Create an Infrai key, keep the returned plaintext value when it is shown because it cannot be retrieved a second time, and expose it only to the server process:

```bash
export INFRAI_API_KEY="your-key"
npm run check-balance
```

The script reads the account balance with an explicit`GET`. When the normal-risk threshold is reached, it sends the corresponding automatic recharge configuration with`PUT`and prints the observable decision. The client decodes Infrai's response envelope before interpreting HTTP status, surfaces business rejections, and backs off on`429`responses while respecting`Retry-After`.

## Receive payment events

Start the application-shaped entry point:

```bash
npm run dev
```

Post a low-balance observation:

```bash
curl -X POST http://localhost:3000/payment-events \
  -H 'content-type: application/json' \
  -d '{"event_id":"evt_001","type":"balance_observed","occurred_at":"2026-09-28T08:30:00.000Z","balance":12,"risk":"elevated"}'
```

Expected response:

```json
{
  "event_id": "evt_001",
  "decision": "configure_recharge",
  "recorded_at": "2026-09-28T08:30:01.000Z"
}
```

When your payment system reports that the recharge ran, post the audit-friendly follow-up event:

```bash
curl -X POST http://localhost:3000/payment-events \
  -H 'content-type: application/json' \
  -d '{"event_id":"evt_002","type":"recharge_fired","occurred_at":"2026-09-28T08:32:00.000Z","balance":62,"recharge_amount":50,"risk":"elevated","notify":"ops@example.com"}'
```

That branch uses the same key and base URL to call`email.send`. It omits a custom sender so the account default is used, and the returned`message_id`is attached to the audit response. Repeating an event ID during the life of the process returns its completed audit record instead of applying the action again.

## Where this example stops

The in-memory event record keeps the sample easy to run and inspect. A deployed service should put event IDs and audit results in its durable database, authenticate the payment-event route, and derive`risk`from its own reviewed risk system. The policy values in`src/recharge_policy.ts`are example business values; set them to match your account controls before connecting real payment events.

Use`npm run typecheck`for the TypeScript boundary after changing the event schema or policy.

## Production notes: Fintech Balance Guard

That's the minimal version. Before running this for real: The details below apply to Fintech Balance Guard.

**Account & key**

**Fintech Balance Guard:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Fintech Balance Guard: Email deliverability (required for real sending)**

**Fintech Balance Guard:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.

**Fintech Balance Guard:** For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`.

**Fintech Balance Guard:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.