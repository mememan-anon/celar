import { FastifyInstance } from "fastify";
import { requireApiKey } from "../auth.ts";
import { updatePspWebhook } from "../controllers/updateWebhook.ts";
import { getWebhookDeliveries } from "../../webhookModule/queue.ts";

// Update PSP webhook URL or provide it
export async function webhookRoutes(app: FastifyInstance) {

app.patch('/psps/webhook', { preHandler: requireApiKey }, updatePspWebhook);


app.get('/webhook-deliveries/:payment_id', {
    preHandler: requireApiKey
  }, getWebhookDeliveries);
}