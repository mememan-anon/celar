import { evaluateBestRoute } from "./routeScorer.ts";
import { SUPPORTED_CHAINS } from "./utils/chains.ts";
import { ADAPTER_REGISTRY } from "./adapters/index.ts";
import type { Chain } from "./utils/types.ts";
import { generateKernelWallet } from "./smartwallet/settleSmartWallet.ts";
import { findCachedRoute } from "./routeCache.ts";

export async function resolveRouteForPayment(
  paymentId: string,
  amount: string,
  currency: "USDC" | "USDT",
  chain: string
): Promise<{
    resolvedChain: Chain;
    tokenAddress: string;
    intermediaryWallet: string;
    estimatedFee: string;
    estimatedTime: number;
    healthScore?: number;
    rankingScore?: number;
}> {
  let resolvedChain: Chain;
  let tokenAddress: string;
  // let intermediaryWallet: string;
  let estimatedFee: string;
  let estimatedTime: number;
  let healthScore: number | undefined;
  let rankingScore: number | undefined;

  
  // console.log(`[ROUTE] Starting route resolution:`);
  // console.log(`- paymentId: ${paymentId}`);
  // console.log(`- amount: ${amount}`);
  // console.log(`- currency: ${currency}`);
  // console.log(`- input chain: ${chain}`);
  
  if (chain === "best") {
    const candidates = await evaluateBestRoute(amount, currency);
    const [bestRoute] = candidates;
    console.log(`[ROUTE] All route candidates:`);

    // for (const route of candidates) {
    //   console.log(`- chain: ${route.chain}`);
    //   console.log(`  token: ${route.token}`);
    //   console.log(`  fee: ${route.estimatedFee}`);
    //   console.log(`  time: ${route.estimatedTime}`);
    //   console.log(`  health: ${route.healthScore}`);
    //   console.log(`  rankingScore: ${route.rankingScore.toFixed(2)}`);
    // }

    resolvedChain = bestRoute.chain;
    tokenAddress = bestRoute.token;
    estimatedFee = bestRoute.estimatedFee;
    estimatedTime = bestRoute.estimatedTime;
    healthScore = bestRoute.healthScore;
    rankingScore = bestRoute.rankingScore;

    console.log(`[ROUTE] Best route selected:`, {
      resolvedChain,
      tokenAddress,
      estimatedFee,
      estimatedTime,
      healthScore,
      rankingScore
    });
  } else {
    resolvedChain = chain as Chain;
    const cfg = SUPPORTED_CHAINS[resolvedChain];

    // ✅ Try cached route — no save if not found
  const cached = await findCachedRoute(resolvedChain, currency, amount);
  if (cached && cached.length > 0) {
    const [route] = cached;
    tokenAddress = route.token;
    estimatedFee = route.estimatedFee;
    estimatedTime = route.estimatedTime;
    healthScore = route.healthScore;
    rankingScore = route.rankingScore;
  } else {
    console.log(`[ROUTE] Cache miss. Estimating route for static chain: ${resolvedChain}`);
    tokenAddress = currency === "USDT" ? cfg.usdtAddress! : cfg.usdcAddress!;
    const adapter = ADAPTER_REGISTRY[resolvedChain];
    
    estimatedFee = await adapter.getEstimatedFee(amount, currency);
    estimatedTime = await adapter.getEstimatedTime();

    // console.log(`[ROUTE] Estimates for static chain:`);
    // console.log(`- token: ${tokenAddress}`);
    // console.log(`- fee: ${estimatedFee}`);
    // console.log(`- time: ${estimatedTime}`);
  }
}

  const intermediaryWallet = await generateKernelWallet(paymentId, resolvedChain);
  console.log(`[ROUTE] Generated Kernel smart wallet: ${intermediaryWallet}`);

  return { 
    resolvedChain, 
    tokenAddress, 
    intermediaryWallet, 
    estimatedFee,
    estimatedTime,
    healthScore,
    rankingScore,
  };
}
