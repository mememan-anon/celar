import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import db from '../connectors/db.ts';
import { withdrawalSchema } from '../schemas/schema.ts';

export async function requestWithdrawal(req: FastifyRequest, reply: FastifyReply) {
  const parse = withdrawalSchema.safeParse(req.body);
  if (!parse.success) {
    return reply.status(400).send({ error: parse.error.flatten() });
  }

  const psp = (req as any).psp;
  const { amount, currency, destination } = parse.data;

  const requestedAmount = parseFloat(amount);
  if (requestedAmount <= 0 || isNaN(requestedAmount)) {
    return reply.status(400).send({ error: 'Withdrawal amount must be greater than 0' });
  }

  // 🔹 Sum all confirmed payments for this PSP
  const confirmed = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE psp_id = ? AND status = 'confirmed'
  `).get(psp.id) as { total: number };

  // 🔹 Sum all previous withdrawals by this PSP
  const withdrawn = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM withdrawals
    WHERE psp_id = ?
  `).get(psp.id) as { total: number };

  const available = confirmed.total - withdrawn.total;

  if (requestedAmount > available) {
    return reply.status(400).send({
      error: `Insufficient balance. Available: ${available.toFixed(2)}, Requested: ${requestedAmount}`
    });
  }

  const withdrawal_id = `wd_${crypto.randomBytes(8).toString('hex')}`;

  db.prepare(`
    INSERT INTO withdrawals (id, psp_id, amount, currency, destination)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    withdrawal_id,
    psp.id,
    requestedAmount.toFixed(2),
    currency,
    destination || null
  );

  return reply.status(201).send({
    withdrawal_id,
    amount: requestedAmount.toFixed(2),
    currency,
    destination: destination || null,
    status: 'pending',
    created_at: new Date().toISOString()
  });
}

export async function getWithdrawals(req: FastifyRequest, reply: FastifyReply) {
  const psp = (req as any).psp;
  const { status, limit = 20, offset = 0 } = req.query as {
    status?: string;
    limit?: number;
    offset?: number;
  };

  let query = `
    SELECT id AS withdrawal_id, amount, currency, destination,
           status, tx_hash, created_at, confirmed_at
    FROM withdrawals
    WHERE psp_id = ?
  `;
  const params: any[] = [psp.id];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const results = db.prepare(query).all(...params);

  return reply.send({
    withdrawals: results,
    pagination: { limit, offset, count: results.length }
  });
}
