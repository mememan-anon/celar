import { WebhookPayload } from './types.ts';
import { sendWebhook } from './queue.ts';

export async function deliverWebhook(payload: WebhookPayload) {
  await sendWebhook(payload);
}