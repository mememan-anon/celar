import { FastifyInstance } from 'fastify';
import { syncMerchants, getMerchants, deactivateMerchant } from '../controllers/merchants.ts';
import { requireApiKey } from '../auth.ts';
import { getMerchantBalance } from '../controllers/getMerchantBalance.ts';

export async function merchantRoutes(app: FastifyInstance) {
  app.post('/merchants/sync', { preHandler: requireApiKey }, syncMerchants);
  app.get('/merchants', { preHandler: requireApiKey }, getMerchants);
  app.delete('/merchants/:merchant_id', { preHandler: requireApiKey }, deactivateMerchant);

  app.get('/merchant/:merchant_id/balance', {
    preHandler: requireApiKey
  }, getMerchantBalance);
  
}
