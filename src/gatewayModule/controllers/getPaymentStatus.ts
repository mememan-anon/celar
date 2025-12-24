import { FastifyRequest, FastifyReply } from 'fastify';
import db from '../connectors/db.ts';
import type { PaymentCustomer } from '../utils/types.ts';

export async function getPaymentStatus(req: FastifyRequest, reply: FastifyReply) {
  const psp = (req as any).psp;
  const { payment_id } = req.params as { payment_id: string };

  const payment = db.prepare(`
    SELECT id AS payment_id, merchant_id, amount, currency, chain, status,
        confirmed_at, magic_link_url, created_at, updated_at, token_address, intermediary_wallet
    FROM payments
    WHERE id = ? AND psp_id = ?
  `).get(payment_id, psp.id) as PaymentCustomer;
  
  if (!payment) {
    return reply.status(404).send({ error: 'Payment not found or not owned by this PSP' });
  }
  
  const usedStatuses = new Set(['confirmed', 'settled', 'settling', 'settled_failed']);
  return reply.send({
    ...payment,
    magic_link_status: usedStatuses.has(payment.status)
      ? 'used'
      : payment.status === 'failed'
      ? 'failed'
      : 'pending'
  });
  
}

export async function getPayments(req: FastifyRequest, reply: FastifyReply) {
  const psp = (req as any).psp;

  const { limit = 20, offset = 0, status, merchant_id } = req.query as {
    limit?: number;
    offset?: number;
    status?: string;
    merchant_id?: string;
  };

  let query = `
    SELECT id AS payment_id, merchant_id, amount, currency, chain,
           status, created_at
    FROM payments
    WHERE psp_id = ?
  `;
  const params: any[] = [psp.id];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (merchant_id) {
    query += ' AND merchant_id = ?';
    params.push(merchant_id);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const results = db.prepare(query).all(...params);

  return reply.send({
    results,
    pagination: {
      limit,
      offset,
      count: results.length
    }
  });
}

//not authenticated endpoint to lookup a paymne to help in payment
export async function getPendingPayment(req: FastifyRequest, reply: FastifyReply) {
  const { payment_id } = req.params as { payment_id: string };

  const payment = db.prepare(`
    SELECT id AS payment_id, amount, currency, chain, status,
           intermediary_wallet, token_address, magic_link_url,
           created_at, confirmed_at, updated_at
    FROM payments
    WHERE id = ?
  `).get(payment_id) as PaymentCustomer;

  if (!payment) {
    return reply.status(404).send({ error: 'Payment not found' });
  }

  // Disallowed statuses
  const excludedStatuses = new Set(['settled', 'settling', 'settled_failed']);
  if (excludedStatuses.has(payment.status)) {
    return reply.status(403).send({ error: 'Payment no longer accessible' });
  }

  return reply.send({
    payment_id: payment.payment_id,
    amount: payment.amount,
    currency: payment.currency,
    chain: payment.chain,
    status: payment.status,
    intermediary_wallet: payment.intermediary_wallet,
    created_at: payment.created_at,
  });
}