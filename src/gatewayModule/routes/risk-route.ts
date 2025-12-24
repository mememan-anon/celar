import { FastifyInstance } from 'fastify';
import { requireApiKey } from '../auth.ts';
import { getRiskHistory, getRiskSummaryByMerchant, getTotalRiskSummary, getTransactionRisk } from '../controllers/transactionRisk.ts';

export async function riskRoutes(app: FastifyInstance) {
  app.get('/transaction-risk/:payment_id', { preHandler: requireApiKey }, getTransactionRisk);
  app.get('/risk-history',  { preHandler: requireApiKey }, getRiskHistory);
  app.get('/risk-summary/by-merchant', { preHandler: requireApiKey }, getRiskSummaryByMerchant);
  app.get('/risk-summary/total', { preHandler: requireApiKey }, getTotalRiskSummary);
  
}