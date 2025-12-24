import db from "../../gatewayModule/connectors/db.ts";
import { PendingPayment, Payment, RecordTxAttemptParams, MismatchedPaymentStatus } from "./types.ts";
import crypto from "node:crypto";
import { webhookOnFailure } from "./webhookHelpers.ts";

export function getUnconfirmedPayments(): PendingPayment[] {
  const stmt = db.prepare(`
    SELECT id, chain, currency, amount, psp_id, token_address, intermediary_wallet, created_block_number
    FROM payments
    WHERE status = 'pending'
      AND created_block_number IS NOT NULL
  `);
    return stmt.all() as PendingPayment[];
  }

  export function getConfirmedUnsettledPayments(): PendingPayment[] {
    const stmt = db.prepare(`
      SELECT p.*
      FROM payments p
      WHERE p.status IN ('confirmed', 'settling')
      AND NOT EXISTS (
        SELECT 1 FROM routed_transactions r
        WHERE r.payment_id = p.id AND r.target = 'psp'
      )
    `);
    return stmt.all() as PendingPayment[];
  }
  
  export function markPendingPaymentAsFailed(id: string) {
    const stmt = db.prepare(`
      UPDATE payments
      SET status = 'failed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `);
  
    const result = stmt.run(id);
  }

  export function markPaymentAsConfirmed(paymentId: string, senderAddress: string) {
    const now = new Date().toISOString();
  
    const stmt = db.prepare(`
      UPDATE payments
      SET status = 'confirmed',
          confirmed_at = ?,
          customer_address = ?
      WHERE id = ?
    `);
  
    stmt.run(now, senderAddress, paymentId);
  }
  

export function getPaymentById(paymentId: string): Payment | null {
  const stmt = db.prepare(`SELECT * FROM payments WHERE id = ?`);
  return stmt.get(paymentId) as Payment | null;
}

export function insertRouteForPayment(paymentId: string, route: {
  chain: string;
  token: string;
  estimatedFee: string;
  estimatedTime: number;
  healthScore?: number;
  rankingScore?: number;
  txHash?: string;
  wasUsed?: boolean;
}) {
  const id = `route_${crypto.randomBytes(6).toString("hex")}`;

  const stmt = db.prepare(`
    INSERT INTO payment_routes (
    id, payment_id, chain, token, estimated_fee, estimated_time,
    health_score, ranking_score, tx_hash, was_used
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

  stmt.run(
    id,
    paymentId,
    route.chain,
    route.token,
    route.estimatedFee,
    route.estimatedTime,
    route.healthScore ?? null,
    route.rankingScore ?? null,
    route.txHash ?? null,
    route.wasUsed ? 1 : 0 
  );
}

export function markRouteAsUsed({
  paymentId,
  txHash,
}: {
  paymentId: string;
  txHash: string;
}) {
  const stmt = db.prepare(`
    UPDATE payment_routes
    SET was_used = 1,
        tx_hash = ?
    WHERE payment_id = ?
    ORDER BY decided_at DESC
    LIMIT 1
  `);

  stmt.run(txHash, paymentId);
}

export function markPaymentAsSettled(paymentId: string) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE payments
    SET status = 'settled',
        settled_at = ?
    WHERE id = ?
  `);
  stmt.run(now, paymentId);
}
export function isTargetAlreadyProcessed(paymentId: string, target: string): boolean {
  const stmt = db.prepare(`
    SELECT 1 FROM routed_transactions
    WHERE payment_id = ? AND target = ?
    LIMIT 1
  `);
  return !!stmt.get(paymentId, target);
}

export function isPaymentAlreadyConfirmed(paymentId: string): boolean {
  const row = db.prepare(`SELECT status FROM payments WHERE id = ?`).get(paymentId) as { status?: string };
  return row?.status === "confirmed";
}

// /**
//  * Fetches all TX attempts for a given payment and target (e.g. 'psp' or 'incoming').
//  */
// export function getTxAttemptsForPaymentTarget(paymentId: string, target: string): RecordTxAttemptParams[] {
//   const stmt = db.prepare(`
//     SELECT *
//     FROM routed_transactions
//     WHERE payment_id = ?
//       AND target = ?
//     ORDER BY attempt ASC
//   `);
//   return stmt.all(paymentId, target) as RecordTxAttemptParams[];
// }
export function markPaymentAsSettledFailed(paymentId: string) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE payments
    SET status = 'settled_failed',
        settled_at = ?
    WHERE id = ?
  `);
  stmt.run(now, paymentId);
}

export function markPaymentAsSettling(paymentId: string) {
  const stmt = db.prepare(`
    UPDATE payments
    SET status = 'settling'
    WHERE id = ?
  `);
  stmt.run(paymentId);
}

export function recordMismatchedPayment({
  paymentId,
  txHash,
  sender,
  expectedAmount,
  receivedAmount,
  status,
}: {
  paymentId: string;
  txHash: string;
  sender: string;
  expectedAmount: string;
  receivedAmount: string;
  status: MismatchedPaymentStatus;
}) {
  const stmt = db.prepare(`
    INSERT INTO mismatched_payments (
      payment_id,
      tx_hash,
      sender,
      expected_amount,
      received_amount,
      status
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(paymentId, txHash, sender, expectedAmount, receivedAmount, status);
}

export function markPaymentAsMismatched(id: string, senderAddress: string) {
  const stmt = db.prepare(`
    UPDATE payments 
    SET status = 'mismatched',
          customer_address = ?
    WHERE id = ?
  `);
  stmt.run(senderAddress, id);
}

export function getWebhookUrl(pspId: string): string | null {
  const row = db.prepare(`
    SELECT webhook_url FROM psps WHERE id = ?
  `).get(pspId) as { webhook_url?: string } | undefined;

  if (!row?.webhook_url || typeof row.webhook_url !== 'string') {
    return null;
  }

  const url = row.webhook_url.trim();
  if (!/^https?:\/\//.test(url)) {
    console.warn(`[Webhook] Invalid webhook_url for PSP ${pspId}: ${url}`);
    return null;
  }

  return url;
}

export function cancelStalePendingPayments(minutes = 15) {
  const cutoff = `-${minutes} minutes`;

  const stmt = db.prepare(`
    SELECT id, psp_id FROM payments
    WHERE status = 'pending'
      AND datetime(updated_at) <= datetime('now', ?)
  `);

  const payments = stmt.all(cutoff) as { id: string; psp_id: string }[];

  const updateStmt = db.prepare(`
    UPDATE payments SET status = 'failed' WHERE id = ?
  `);

  for (const payment of payments) {
    updateStmt.run(payment.id);
    console.log(`[🕒] Marked stale payment ${payment.id} as failed`);

    webhookOnFailure(payment.psp_id, payment.id, { 
      reason: "Payment not received within the required timeframe. Marked as failed due to timeout." })
      .catch((err) => console.error(`Webhook failed for ${payment.id}:`, err));
  }
}
