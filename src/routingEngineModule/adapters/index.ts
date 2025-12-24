import type { ChainAdapter, Chain } from "../utils/types.ts";
import { baseAdapter } from "./baseAdaptor.ts";
import { polygonAdapter } from "./polygonAdaptor.ts";
import { arbitrumAdapter } from "./arbitrumAdaptor.ts";

/**
 * Registry of all available chain adapters keyed by Chain.
 */
export const ADAPTER_REGISTRY: Record<Chain, ChainAdapter> = {
  base: baseAdapter,
  polygon: polygonAdapter,
  arbitrum: arbitrumAdapter
};

export function getChainAdapter(chain: Chain): ChainAdapter {
  switch (chain) {
    case "base":
      return baseAdapter;
    case "polygon":
      return polygonAdapter;
      case "arbitrum":
        return arbitrumAdapter;
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}