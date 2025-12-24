import { FastifyRequest, FastifyReply } from 'fastify';
import { syncMerchantsSchema } from '../schemas/schema.ts';
import db from '../connectors/db.ts';
import crypto from 'node:crypto';

//add merchant and update them
export async function syncMerchants(req: FastifyRequest, reply: FastifyReply) {
  const parse = syncMerchantsSchema.safeParse(req.body);

  if (!parse.success) {
    return reply.status(400).send({ error: parse.error.flatten() });
  }

  const psp = (req as any).psp;
  const { merchants } = parse.data;

  let created = 0;
  let updated = 0;
  const syncedMerchants: { external_id: string; merchant_id: string }[] = [];

  const updateStmt = db.prepare(`
    UPDATE merchants SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP
    WHERE psp_id = ? AND external_id = ?
  `);

  const insertStmt = db.prepare(`
    INSERT INTO merchants (id, merchant_id, psp_id, external_id, name, email, business_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const normalize = (val: string | undefined) => (val || '').trim().toUpperCase();

  for (const m of merchants) {
    const existing = db.prepare(`
      SELECT merchant_id, name, email, business_id FROM merchants WHERE psp_id = ? AND external_id = ?
    `).get(psp.id, m.external_id) as {
      merchant_id: string;
      name: string;
      email: string;
      business_id: string;
    } | undefined;

    if (existing) {
      const nameChanged = m.name.trim() !== existing.name.trim();
      const emailChanged = m.email.trim().toLowerCase() !== existing.email.trim().toLowerCase();
      const businessIdChanged = normalize(m.business_id) !== normalize(existing.business_id);

      if (businessIdChanged) {
        return reply.status(400).send({
          error: `Business ID cannot be updated for merchant '${m.external_id}'. Tried '${normalize(m.business_id)}' vs '${normalize(existing.business_id)}'.`
        });
      }

      if (!nameChanged && !emailChanged) {
        syncedMerchants.push({
          external_id: m.external_id,
          merchant_id: existing.merchant_id
        });
        continue;
      }

      updateStmt.run(m.name, m.email, psp.id, m.external_id);
      syncedMerchants.push({
        external_id: m.external_id,
        merchant_id: existing.merchant_id
      });
      updated++;
    } else {
      const merchantId = `mcht_${crypto.randomBytes(8).toString('hex')}`;
      insertStmt.run(
        crypto.randomUUID(),
        merchantId,
        psp.id,
        m.external_id,
        m.name,
        m.email,
        m.business_id
      );
      syncedMerchants.push({
        external_id: m.external_id,
        merchant_id: merchantId
      });
      created++;
    }
  }

  if (created === 0 && updated === 0) {
    return reply.send({
      message: 'Merchant sync complete — no changes detected.',
      synced: merchants.length,
      created,
      updated,
      merchants: syncedMerchants
    });
  }

  return reply.send({
    message: 'Merchant sync complete',
    synced: merchants.length,
    created,
    updated,
    merchants: syncedMerchants
  });
}

//get merchants
export async function getMerchants(req: FastifyRequest, reply: FastifyReply) {
    const psp = (req as any).psp;
    const { name, email, limit = 20, offset = 0 } = req.query as {
      name?: string;
      email?: string;
      limit?: number;
      offset?: number;
    };
  
    let query = `
      SELECT merchant_id, external_id, name, email, business_id, created_at, updated_at
      FROM merchants
      WHERE psp_id = ?
    `;
    const params: any[] = [psp.id];
  
    if (name) {
      query += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    if (email) {
      query += ' AND email LIKE ?';
      params.push(`%${email}%`);
    }
  
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
  
    const rows = db.prepare(query).all(...params);
    return reply.send({ merchants: rows, limit, offset });
  }
  
  //soft delete merchant + deactivate merchant
  export async function deactivateMerchant(req: FastifyRequest, reply: FastifyReply) {
    const psp = (req as any).psp;
    const { merchant_id } = req.params as { merchant_id: string };
  
    const stmt = db.prepare(`
      UPDATE merchants SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE merchant_id = ? AND psp_id = ?
    `);
    const result = stmt.run(merchant_id, psp.id);
  
    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Merchant not found or not owned by this PSP' });
    }
  
    return reply.send({ message: 'Merchant deactivated successfully', merchant_id });
  }