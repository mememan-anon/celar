import { request } from 'undici';
import { WebhookPayload, DeliveryStatus } from './types.ts';
import { logWebhookDelivery } from './storeLog.ts';
import db from '../gatewayModule/connectors/db.ts';

export async function sendWebhook(payload: WebhookPayload) {
  const { url, event, payload: body, attempt = 1, maxAttempts = 3 } = payload;

  try {
    const res = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data: body, sent_at: new Date().toISOString() })
    });

    const responseText = await res.body.text();
    const status: DeliveryStatus = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failed';

    logWebhookDelivery({
      url,
      event,
      payload: body,
      responseCode: res.statusCode,
      responseBody: responseText,
      status,
      attempt
    });

    if (status === 'failed') throw new Error(`Webhook failed with status ${res.statusCode}`);
    console.log(`[Webhook] Delivered: ${event} to ${url}`);
  } catch (err: any) {
    console.error(`[Webhook] Delivery error:`, err);
    logWebhookDelivery({
      url,
      event,
      payload: body,
      responseCode: 0,
      responseBody: err.message,
      status: 'failed',
      attempt
    });

    if (attempt < maxAttempts) {
      const delay = 2000 * attempt;
      console.warn(`[Webhook] Retry in ${delay}ms (attempt ${attempt + 1})`);
      setTimeout(() => sendWebhook({ ...payload, attempt: attempt + 1 }), delay);
    }
  }
}

export function getWebhookDeliveries(req: any, reply: any) {
  const { payment_id } = req.params;
  const pspId = req.psp?.id;

  const valid = db.prepare(`SELECT 1 FROM payments WHERE id = ? AND psp_id = ?`).get(payment_id, pspId);
  if (!valid) return reply.status(403).send({ error: 'Unauthorized access' });

  const deliveries = db.prepare(`
    SELECT id, event, url, status, attempt, response_code,
           response_body, payload, created_at AS sent_at
    FROM webhook_deliveries
    WHERE payment_id = ?
    ORDER BY created_at DESC
  `).all(payment_id);

  return reply.send({ payment_id, deliveries });
}