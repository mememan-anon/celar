export type WebhookEvent =
  | 'payment.confirmed'
  | 'payment.settled'
  | 'payment.settlement_failed'
  | 'payment.failed'
  | 'payment.mismatched';

export interface WebhookPayload {
  url: string;
  event: WebhookEvent;
  payload: Record<string, any>;
  attempt?: number;
  maxAttempts?: number;
}

export interface WebhookParams {
  pspId: string;
  event: WebhookEvent;
  payload: Record<string, any>;
}
export type DeliveryStatus = 'success' | 'failed';
