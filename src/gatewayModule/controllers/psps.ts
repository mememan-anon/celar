import { FastifyReply, FastifyRequest } from 'fastify';
import { registerPspSchema } from '../schemas/schema.ts';
import db from '../connectors/db.ts';
import crypto from 'node:crypto';
import { generateApiKey, hashApiKey } from '../utils/apiKey.ts';


export async function registerPsp(req: FastifyRequest, reply: FastifyReply) {
  const parse = registerPspSchema.safeParse(req.body);

  if (!parse.success) {
    return reply.status(400).send({ error: parse.error.flatten() });
  }

  const { 
    business_name,
    contact_email, 
    wallet_address,
    registered_country,
    business_type,
    primary_use_case,
    expected_monthly_volume,
    source_of_funds,
    license_number,
    website
   } = parse.data;

   const shortId = crypto.randomBytes(6).toString('hex');
   const id = `psp_${shortId}`;
  ///validating to ensure the psp is not registered twice
  const existing = db.prepare(`SELECT 1 FROM psps WHERE id = ?`).get(id);
  if (existing) {
    return reply.status(409).send({ error: 'A PSP with this ID already exists. Please try again.' });
  }

  // Generate a unique API key and its hash and ensure no psp has used it b4
  let apiKey: string, apiKeyHash: string, collision;
  do {
    apiKey = generateApiKey();
    apiKeyHash = hashApiKey(apiKey);
    collision = db.prepare(`SELECT 1 FROM psps WHERE api_key_hash = ?`).get(apiKeyHash);
  } while (collision);

  // Insert into DB
  db.prepare(`
    INSERT INTO psps (
      id, business_name, contact_email, api_key_hash, wallet_address,
      registered_country, business_type, primary_use_case,
      expected_monthly_volume, source_of_funds, license_number, website,
      approval_status, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `).run(
    id,
    business_name,
    contact_email,
    apiKeyHash,
    wallet_address,
    registered_country,
    business_type,
    primary_use_case,
    expected_monthly_volume,
    source_of_funds,
    license_number,
    website
  );

  return reply.status(201).send({
    id,
    business_name,
    contact_email,
    wallet_address,
    registered_country,
    business_type,
    primary_use_case,
    expected_monthly_volume,
    source_of_funds,
    license_number,
    approval_status: 'pending',
    website,
    created_at: new Date().toISOString(),
    api_key: apiKey,
    message:
      'PSP registered successfully. Awaiting approval. Please store your API key securely — it will not be shown again.'
  });
}