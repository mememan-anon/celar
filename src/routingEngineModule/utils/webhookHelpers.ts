// webhookHelper.ts
import { deliverWebhook } from "../../webhookModule/deliver.ts";
import {WebhookParams } from "../../webhookModule/types.ts";
import { getWebhookUrl } from "./paymentService.ts";

export async function sendSafeWebhook({ pspId, event, payload }: WebhookParams) {
  const url = getWebhookUrl(pspId);
  if (!url) {
    console.warn(`[Webhook] Skipped: No valid webhook URL for PSP ${pspId}`);
    return;
  }

  try {
    await deliverWebhook({ url, event, payload });
  } catch (err) {
    console.error(`[Webhook] Failed to deliver event ${event} for PSP ${pspId}:`, err);
  }
}

// Optional: shortcut wrappers for specific events
export async function webhookOnConfirmed(pspId: string, paymentId: string, extra: Record<string, any> = {}) {
  await sendSafeWebhook({
    pspId,
    event: "payment.confirmed",
    payload: { payment_id: paymentId, ...extra },
  });
}

export async function webhookOnSettled(pspId: string, paymentId: string, extra: Record<string, any> = {}) {
  await sendSafeWebhook({
    pspId,
    event: "payment.settled",
    payload: { payment_id: paymentId, ...extra },
  });
}

export async function webhookOnMismatch(pspId: string, paymentId: string, extra: Record<string, any> = {}) {
  await sendSafeWebhook({
    pspId,
    event: "payment.mismatched",
    payload: { payment_id: paymentId, ...extra },
  });
}

export async function webhookOnFailure(pspId: string, paymentId: string, extra: Record<string, any> = {}) {
  await sendSafeWebhook({
    pspId,
    event: "payment.failed",
    payload: { payment_id: paymentId, ...extra },
  });
}

export async function webhookOnSettleFailed(pspId: string, paymentId: string, extra: Record<string, any> = {}) {
  await sendSafeWebhook({
    pspId,
    event: "payment.settlement_failed",
    payload: { payment_id: paymentId, ...extra },
  });
}
