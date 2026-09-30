import { InfraiClient } from "./infrai_client.ts";
import { decidePaymentAction, type PaymentEvent } from "./recharge_policy.ts";

export type AuditResult = {
  event_id: string;
  decision: string;
  recorded_at: string;
  message_id?: string;
};

export class PaymentEventService {
  private readonly completed = new Map<string, AuditResult>();
  private readonly client: InfraiClient;

  constructor(client: InfraiClient) {
    this.client = client;
  }

  async handle(event: PaymentEvent): Promise<AuditResult> {
    const previous = this.completed.get(event.event_id);
    if (previous) return previous;

    const decision = decidePaymentAction(event);
    const audit: AuditResult = {
      event_id: event.event_id,
      decision: decision.action,
      recorded_at: new Date().toISOString()
    };

    if (decision.action === "configure_recharge") {
      await this.client.configureAutoRecharge(decision.policy);
    }

    if (decision.action === "notify_recharge" && event.type === "recharge_fired") {
      const sent = await this.client.sendEmail({
        to: event.notify,
        subject: `Recharge recorded: ${event.event_id}`,
        body: [
          `Payment event: ${event.event_id}`,
          `Occurred at: ${event.occurred_at}`,
          `Balance at event: ${event.balance}`,
          `Recharge amount: ${event.recharge_amount}`,
          `Risk classification: ${event.risk}`
        ].join("\n")
      });
      audit.message_id = sent.message_id;
    }

    this.completed.set(event.event_id, audit);
    return audit;
  }
}
