import db from "../../gatewayModule/connectors/db.ts";
import { RecordTxAttemptParams} from "../utils/types.ts";

export function recordTxAttempt({
  paymentId,
  txHash,
  chain,
  token,
  amount,
  target,
  attempt,
  success,
  error,
  meta
}: RecordTxAttemptParams) {
  const stmt = db.prepare(`
    INSERT INTO routed_transactions (
      payment_id, tx_hash, chain, token, amount,
      target, attempt, success, error, routed_at, meta
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    paymentId,
    txHash ?? null,
    chain,
    token,
    amount,
    target,
    attempt,
    success ? 1 : 0,
    error ?? null,
    new Date().toISOString(),
    meta ? JSON.stringify(meta) : null
  );

  const label = success ? "✅ SUCCESS" : "❌ FAILURE";
  console.log(`[${label}] TX attempt ${attempt} for ${target.toUpperCase()} on ${paymentId}`);
}
