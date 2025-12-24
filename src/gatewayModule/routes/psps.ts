import { FastifyInstance } from 'fastify';
import { registerPsp } from '../controllers/psps.ts';
import { requireApiKey } from '../auth.ts';
import { getWithdrawals, requestWithdrawal } from '../controllers/withdrawals.ts';

export async function pspRoutes(app: FastifyInstance) {
  // Register a new PSP
  app.post('/psps/register', registerPsp);
 
  //check psp credentials
  app.get('/psps/me', { preHandler: requireApiKey }, async (req, reply) => {
    const psp = (req as any).psp;

    return reply.send({
      id: psp.id,
      name: psp.name,
      contact_email: psp.contact_email,
      created_at: psp.created_at,
      wallet_address: psp.wallet_address,
      registered_country: psp.registered_country,
      business_type: psp.business_type,
      primary_use_case: psp.primary_use_case,
      expected_monthly_volume: psp.expected_monthly_volume,
      source_of_funds: psp.source_of_funds,
      website: psp.website,
      status: psp.approval_status,
      webhook_url: psp.webhook_url || null,
    });
  });
//request a widrawal -- add more security here 2fa, email
  app.post('/psps/withdraw', { preHandler: requireApiKey}, requestWithdrawal);
  //check withrawals by psp
  app.get('/psps/withdrawals', { preHandler: requireApiKey}, getWithdrawals);

}
