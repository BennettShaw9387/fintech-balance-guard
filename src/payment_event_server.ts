import { createServer } from "node:http";
import { z } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client.ts";
import { PaymentEventService } from "./payment_event_service.ts";
import { paymentEventSchema } from "./recharge_policy.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");

const service = new PaymentEventService(new InfraiClient(key));
const port = Number(process.env.PORT ?? "3000");

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/payment-events") {
    sendJson(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const event = paymentEventSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    sendJson(response, 200, await service.handle(event));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "invalid_payment_event" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, message: error.message });
      return;
    }
    sendJson(response, 500, { error: "service_error" });
  }
});

server.listen(port, () => {
  console.log(`Payment event service listening on http://localhost:${port}`);
});
