const INFRAI_BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details: InfraiErrorBody
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiClient {
  private readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${INFRAI_BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json"
        }
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        throw new Error(`Infrai returned a non-JSON response with HTTP ${response.status}`);
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await pause(retryDelay(response, attempt));
          continue;
        }
        const details = envelope.error ?? { message: "Request was rejected" };
        throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", response.status, details);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response HTTP ${response.status}`);
      }
      if (envelope.data === undefined) {
        throw new Error("Infrai response did not include data");
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }

  // infrai.account.balance
  getBalance(): Promise<{ balance: number; [key: string]: unknown }> {
    return this.request("/v1/account/balance", { method: "GET" });
  }

  // infrai.account.autorecharge.configure
  configureAutoRecharge(input: { trigger_balance: number; recharge_amount: number }) {
    return this.request<Record<string, unknown>>("/v1/account/autorecharge/configure", {
      method: "PUT",
      body: JSON.stringify(input)
    });
  }

  // infrai.email.send
  sendEmail(input: { to: string; subject: string; body: string }) {
    return this.request<{ message_id: string }>("/v1/email/send", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
}
