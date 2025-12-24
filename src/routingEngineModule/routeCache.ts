import type { CachedRouteEntry, RouteCacheKey, RouteCandidate } from "./utils/types";
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not defined in the environment variables.");
}

const redis = new Redis(process.env.REDIS_URL);

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function saveRouteToCache(
  chain: string,
  currency: string,
  amount: string,
  candidates: RouteCandidate[]
): Promise<void> {
  const key = getRouteCacheKey(chain, currency, amount);
  const entry: CachedRouteEntry = {
    candidates,
    cachedAt: Date.now(),
  };

  await redis.set(key, JSON.stringify(entry), "PX", CACHE_TTL_MS);
}

export async function findCachedRoute(
  chain: string,
  currency: string,
  amount: string
): Promise<RouteCandidate[] | null> {
  const key = getRouteCacheKey(chain, currency, amount);
  const raw = await redis.get(key);
  if (!raw) return null;

  try {
    const entry = JSON.parse(raw) as CachedRouteEntry;
    console.log(`[CACHE] Using cached route for ${chain}-${currency}-${amount}`);
    return isStaleRoute(entry) ? null : entry.candidates;
  } catch (err) {
    console.error(`[Redis] Failed to parse route entry for key ${key}:`, err);
    return null;
  }
}

function isStaleRoute(entry: CachedRouteEntry): boolean {
  return Date.now() - entry.cachedAt > CACHE_TTL_MS;
}

function getRouteCacheKey(
  chain: string,
  currency: string,
  amount: string
): RouteCacheKey {
  const rounded = (Math.round(parseFloat(amount) * 100) / 100).toFixed(2);
  return `route:${chain.toUpperCase()}-${currency.toUpperCase()}-${rounded}`;
}
