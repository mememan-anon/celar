import { FastifyRequest, FastifyReply } from 'fastify';
import db from '../connectors/db.ts';
import { mockRiskEngine } from '../../complianceModule/riskEngine.ts';
import { PaymentRow, RiskCheckRow } from '../utils/types.ts';


export async function getTransactionRisk(req: FastifyRequest, reply: FastifyReply) {
  const psp = (req as any).psp;
  const { payment_id } = req.params as { payment_id: string };

  const payment = db.prepare(`
    SELECT id, status, chain, tx_hash, merchant_id, amount
    FROM payments
    WHERE id = ? AND psp_id = ?
  `).get(payment_id, psp.id) as PaymentRow | undefined;

  if (!payment) {
    return reply.status(404).send({ error: 'Payment not found or not owned by this PSP' });
  }

  if (payment.status !== 'pending') {
    return reply.status(400).send({
      error: 'KYT risk check only available for pending payments'
    });
  }

  const existing = db.prepare(`
    SELECT risk_level, score, flags, checked_at
    FROM risk_checks
    WHERE payment_id = ?
  `).get(payment.id) as RiskCheckRow | undefined;

  if (existing) {
    return reply.send({
      payment_id: payment.id,
      risk_level: existing.risk_level,
      score: existing.score,
      flags: JSON.parse(existing.flags) as string[],
      checked_at: existing.checked_at
    });
  }

  // Run mock risk logic
  const { risk_level, score, flags } = mockRiskEngine(payment);

  // Save result immutably
  db.prepare(`
    INSERT INTO risk_checks (payment_id, psp_id, risk_level, score, flags)
    VALUES (?, ?, ?, ?, ?)
  `).run(payment.id, psp.id, risk_level, score, JSON.stringify(flags));

  return reply.send({
    payment_id: payment.id,
    risk_level,
    score,
    flags,
    checked_at: new Date().toISOString()
  });
}

export async function getRiskHistory(req: FastifyRequest, reply: FastifyReply) {
  const psp = (req as any).psp;
  const { limit = 20, offset = 0, level } = req.query as {
    limit?: number;
    offset?: number;
    level?: 'low' | 'medium' | 'high';
  };

  let query = `
    SELECT rc.payment_id, rc.risk_level, rc.score, rc.flags, rc.checked_at,
           p.merchant_id, p.amount, p.currency, p.chain,
           p.created_at, p.confirmed_at, tx_hash
    FROM risk_checks rc
    JOIN payments p ON p.id = rc.payment_id
    WHERE rc.psp_id = ?
  `;
  const params: any[] = [psp.id];

  if (level) {
    query += ' AND rc.risk_level = ?';
    params.push(level);
  }

  query += ' ORDER BY rc.checked_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params);

  const results = rows.map((row: any) => ({
    payment_id: row.payment_id,
    merchant_id: row.merchant_id,
    amount: row.amount,
    currency: row.currency,
    chain: row.chain,
    created_at: row.created_at,
    confirmed_at: row.confirmed_at,
    tx_hash: row.tx_hash,
    risk_level: row.risk_level,
    score: row.score,
    flags: JSON.parse(row.flags),
    checked_at: row.checked_at
  }));

  return reply.send({
    results,
    pagination: {
      limit,
      offset,
      count: results.length
    }
  });
}

export async function getRiskSummaryByMerchant(req: FastifyRequest, reply: FastifyReply) {
    const psp = (req as any).psp;
  
    const rows = db.prepare(`
      SELECT
        p.merchant_id,
        COUNT(*) AS total_checks,
        SUM(CASE WHEN rc.risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk,
        SUM(CASE WHEN rc.risk_level = 'medium' THEN 1 ELSE 0 END) AS medium_risk,
        SUM(CASE WHEN rc.risk_level = 'low' THEN 1 ELSE 0 END) AS low_risk,
        SUM(rc.score) AS total_score,
        ROUND(AVG(rc.score), 1) AS avg_score
      FROM risk_checks rc
      JOIN payments p ON rc.payment_id = p.id
      WHERE rc.psp_id = ?
      GROUP BY p.merchant_id
      ORDER BY total_score DESC
    `).all(psp.id);
  
    return reply.send(rows);
  }
  
  export async function getTotalRiskSummary(req: FastifyRequest, reply: FastifyReply) {
    const psp = (req as any).psp;
  
    const row = db.prepare(`
      SELECT
        COUNT(*) AS total_checks,
        SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk,
        SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) AS medium_risk,
        SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) AS low_risk,
        SUM(score) AS total_score,
        ROUND(AVG(score), 1) AS avg_score
      FROM risk_checks
      WHERE psp_id = ?
    `).get(psp.id);
  
    return reply.send(row);
  }
  