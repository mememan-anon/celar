import { FastifyRequest, FastifyReply } from 'fastify';
import { webhookUpdateSchema } from '../schemas/schema.ts';
import db from '../connectors/db.ts';

export async function updatePspWebhook(req: FastifyRequest, reply: FastifyReply) {
  const psp = (req as any).psp;

  const parsed = webhookUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const { webhook_url } = parsed.data;

  db.prepare(`UPDATE psps SET webhook_url = ? WHERE id = ?`).run(webhook_url, psp.id);

  return reply.send({
    message: 'Webhook URL updated successfully',
    webhook_url
  });
}
