import type { Chain, RouteCandidate } from "./utils/types.ts";
import { ADAPTER_REGISTRY } from "./adapters/index.ts";
import { findCachedRoute, saveRouteToCache } from "./routeCache.ts";

export async function evaluateBestRoute(
  amount: string,
  currency: "USDC" | "USDT",
  chains?: Chain[]
): Promise<RouteCandidate[]> {

  const toCheck = chains ?? (Object.keys(ADAPTER_REGISTRY) as Chain[]);
  const candidates: RouteCandidate[] = [];

  for (const chain of toCheck) {
    //checking cache first b4 computing again
    const cached = await findCachedRoute(chain, currency, amount);
    if (cached) {
      return cached;
    }

    const adapter = ADAPTER_REGISTRY[chain];
    const cfg = adapter.getConfig();
    const token = currency === "USDT" ? cfg.usdtAddress : cfg.usdcAddress;

    const [feeStr, time, health] = await Promise.all([
      adapter.getEstimatedFee(amount, currency),
      adapter.getEstimatedTime(),
      adapter.checkHealth(),
    ]);

    const fee = parseFloat(feeStr);
    const rankingScore = (health * 2) - (fee * 100) - (time * 5);

    candidates.push({
      chain,
      token,
      estimatedFee: feeStr,
      estimatedTime: time,
      healthScore: health,
      rankingScore,
    });
    // save computed new route to cache
    await saveRouteToCache(chain, currency, amount, [candidates[candidates.length - 1]]);
  }

  // Sort in descedning order: higher score = better route
  candidates.sort((a, b) => b.rankingScore - a.rankingScore);
  return candidates;
}
