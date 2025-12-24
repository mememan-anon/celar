import { FastifyRequest, FastifyReply } from 'fastify';
import db from '../connectors/db.ts';

export async function getMerchantBalance(req: FastifyRequest, reply: FastifyReply) {
  const psp = (req as any).psp;
  const { merchant_id } = req.params as { merchant_id: string };

  const currency = (req.query as any)?.currency?.toUpperCase() || 'USDC';

  if (!['USDC', 'USDT'].includes(currency)) {
    return reply.status(400).send({ error: 'Unsupported currency. Use USDC or USDT.' });
  }
  // Check merchant exists and is owned by PSP
  const merchant = db.prepare(`
    SELECT 1 FROM merchants WHERE merchant_id = ? AND psp_id = ?
  `).get(merchant_id, psp.id);

  if (!merchant) {
    return reply.status(404).send({ error: 'Merchant not found or not owned by this PSP' });
  }

  // Sum confirmed payments
  const totalConfirmed = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments
    WHERE merchant_id = ? AND psp_id = ? AND status = 'confirmed'
  `).get(merchant_id, psp.id, currency) as { total: number };

  const balance = Number(totalConfirmed.total);

  return reply.send({
    merchant_id,
    balance: balance.toFixed(2),
    currency,
  });
}
