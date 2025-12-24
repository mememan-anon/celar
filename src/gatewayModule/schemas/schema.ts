import { z } from 'zod';

export const registerPspSchema = z.object({
  business_name: z.string().min(1, 'Name is required').trim(),
  contact_email: z.string().email('Invalid email').trim(),
  wallet_address: z
    .string()
    .trim()
    .startsWith('0x', { message: 'Must start with 0x' })
    .length(42, 'Invalid wallet address length'),
  registered_country: z
    .string()
    .length(3, 'Must be ISO 3166-1 alpha-3 country code')
    .toUpperCase(),
  license_number: z.string().min(3).max(50).trim(),
  business_type: z.enum(['sole_proprietorship', 'llc', 'corporation', 'dao', 'nonprofit']),
  primary_use_case: z.enum(['payments', 'p2p_transfers', 'payouts', 'remittances']),
  expected_monthly_volume: z.enum([
    '<10000',
    '10000-100000',
    '100000-500000',
    '500000-1000000',
    '>1000000'
  ]),
  source_of_funds: z.enum([
    'customer_funds',
    'investor_funds',
    'business_loans',
    'salary',
    'other'
  ]),
  website: z.string().url('Must be a valid URL').trim()
});

export type RegisterPspInput = z.infer<typeof registerPspSchema>;

export const webhookUpdateSchema = z.object({
  webhook_url: z.string().trim().url("Invalid URL format")
});


export const withdrawalSchema = z.object({
  amount: z.string().trim().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Invalid amount'),
  currency: z.enum(['USDC', 'USDT']),
  destination: z.string().trim().startsWith('0x').length(42).optional()
});

export const merchantSchema = z.object({
    external_id: z.string().min(1).trim(),
    name: z.string().min(1).trim(),
    email: z.string().email().trim(),
    business_id: z.string().min(1).trim()
});

export const syncMerchantsSchema = z.object({
  merchants: z.array(merchantSchema).min(1)
});

export type MerchantInput = z.infer<typeof merchantSchema>;

export const initiatePaymentSchema = z.object({
  merchant_id: z.string().trim().min(1),
  amount: z.string()
  .trim()
  .regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Invalid amount format')
  .refine(val => parseFloat(val) >= 0.01, {
    message: 'Amount must be at least 0.01'
  }),
  currency: z.enum(['USDC', 'USDT']),
  chain: z.enum(['base', 'polygon', 'best', 'arbitrum']),
  reference: z.string().trim().min(1),
  description: z.string().trim().min(1),
  metadata: z.record(z.any())
});
