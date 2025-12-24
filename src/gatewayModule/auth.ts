import { FastifyRequest, FastifyReply } from 'fastify';
import db from './connectors/db.ts';
import { hashApiKey } from './utils/apiKey.ts';
import { Psp } from './utils/types.ts';

export async function requireApiKey(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers['authorization'];

  const apiKey = header?.replace(/^Bearer\s+/i, '');
  if (!apiKey) return reply.status(401).send({ error: 'Missing API key' });
  const hashed = hashApiKey(apiKey);
  const psp = db.prepare(`SELECT * FROM psps WHERE api_key_hash = ?`).get(hashed) as Psp;

  
  if (!psp) return reply.status(401).send({ error: 'Invalid API key' });

  //check if they have been approved
  if (psp.approval_status !== 'approved') {
    return reply.status(403).send({
      error: 'Your DEV account is not approved yet. Please wait for admin approval.'
    });
  }
  (request as any).psp = psp;
}
