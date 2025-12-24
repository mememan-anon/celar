import crypto from 'node:crypto';
import dotenv from "dotenv";

dotenv.config();

export function generateApiKey(): string {
  const keySuffix = crypto.randomBytes(32).toString('hex'); // 64-char
  return `dev_test_${keySuffix}`;
}

export function hashApiKey(apiKey: string): string {
  const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET!);
  return hmac.update(apiKey).digest('hex');
}
