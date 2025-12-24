import { v4 as uuidv4 } from 'uuid';
import { WebhookEvent, DeliveryStatus } from './types.ts';
import db from '../gatewayModule/connectors/db.ts';

export function logWebhookDelivery(params: {
  url: string;
  event: WebhookEvent;
  payload: any;
  responseCode: number;
  responseBody: string;
  status: DeliveryStatus;
  attempt: number;
}) {

  const { url, event, payload, responseCode, responseBody, status, attempt } = params;
  const payment_id = payload?.payment_id;
  if (!payment_id) throw new Error('[Webhook] Missing payment_id in payload');

  db.prepare(`
    INSERT INTO webhook_deliveries (
      id, payment_id, event, url, status, attempt, payload, response_code, response_body, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    uuidv4(),
    payment_id,
    event,
    url,
    status,
    attempt,
    JSON.stringify(payload),
    responseCode,
    responseBody
  );
}
