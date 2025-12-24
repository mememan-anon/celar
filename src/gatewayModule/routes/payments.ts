import { FastifyInstance } from 'fastify';
import { requireApiKey } from '../auth.ts';
import { initiatePayment } from '../controllers/payments.ts';
import { getPaymentStatus, getPayments, getPendingPayment } from '../controllers/getPaymentStatus.ts';

export async function paymentRoutes(app: FastifyInstance) {
  app.post('/payments/initiate', { preHandler: requireApiKey }, initiatePayment);
  app.get('/payments/:payment_id/status', { preHandler: requireApiKey }, getPaymentStatus);
  app.get('/payments', { preHandler: requireApiKey }, getPayments);
  //not authenticated endpoint for public access
  app.get('/pay/:payment_id', {
    config: {
      rateLimit: {
        max: 50,                 
        timeWindow: '1 minute' 
      }
    }
  }, getPendingPayment);
}