import { FastifyRequest, FastifyReply } from 'fastify';
import { initiatePaymentSchema } from '../schemas/schema.ts';
import db from '../connectors/db.ts';
import crypto from 'node:crypto';
import { resolveRouteForPayment } from "../../routingEngineModule/routeResolver.ts";
import { insertRouteForPayment } from '../../routingEngineModule/utils/paymentService.ts';
import { ADAPTER_REGISTRY } from '../../routingEngineModule/adapters/index.ts';

export async function initiatePayment(req: FastifyRequest, reply: FastifyReply) {
  const parse = initiatePaymentSchema.safeParse(req.body);

  if (!parse.success) {
    return reply.status(400).send({ error: parse.error.flatten() });
  }

  const psp = (req as any).psp;
  const {
    merchant_id,
    amount,
    currency,
    chain,
    reference,
    description,
    metadata
  } = parse.data;
  
  const merchant = db.prepare(`
    SELECT 1 FROM merchants WHERE merchant_id = ? AND psp_id = ? AND is_active = 1
  `).get(merchant_id, psp.id);

  if (!merchant) {
    return reply.status(404).send({ error: 'Merchant not found or not owned by this PSP' });
  }
  
  const psp_wallet = (db.prepare(`SELECT wallet_address FROM psps WHERE id = ?`)
  .get(psp.id) as { wallet_address: string })?.wallet_address;

/// later on add a dedicated table for internal uid and then have payment id as separate colum for clarity 
/// for now id == payment_id
  const payment_id = `pay_${crypto.randomBytes(8).toString('hex')}`;
  const magic_link_url = `https://pay.zeno.xyz/pay/${payment_id}`;

  const {
    resolvedChain,
    tokenAddress,
    intermediaryWallet,
    estimatedFee,
    estimatedTime,
    healthScore,
    rankingScore
  } = await resolveRouteForPayment(payment_id, amount, currency, chain);

  //inserting block number to track payments later by routing-engine for old payments
  const adapter = ADAPTER_REGISTRY[resolvedChain];
  const currentBlockNumber = await adapter.getProvider().getBlockNumber();
    db.prepare(`
      INSERT INTO payments (
        id, psp_id, merchant_id, amount, currency, chain,
        reference, description, metadata, magic_link_url,
        token_address, intermediary_wallet, psp_wallet, created_block_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payment_id,           // id
      psp.id,               // psp_id
      merchant_id,          // merchant_id
      amount,               // amount
      currency,             // currency
      resolvedChain,        // 'chain'
      reference,            // reference
      description,          // description
      JSON.stringify(metadata), // metadata
      magic_link_url,       // magic_link_url
      tokenAddress,         // token_address
      intermediaryWallet, 
      psp_wallet,
      currentBlockNumber
    );
    
  // 📝 Save route info into DB
  await insertRouteForPayment(payment_id, {
    chain: resolvedChain,
    token: tokenAddress,
    estimatedFee,
    estimatedTime,
    healthScore,
    rankingScore
  });
    
  return reply.status(201).send({
    payment_id,
    status: 'pending',
    magic_link_url,
    chain: resolvedChain,
    intermediary_wallet: intermediaryWallet,
    token_address: tokenAddress,
    // //dont need display in response
    // healthScore, 
    // rankingScore
  });
}