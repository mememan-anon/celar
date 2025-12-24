import { createPublicClient, http, erc20Abi } from "viem";
import { SUPPORTED_CHAINS } from "./chains.ts";
import type { Chain } from "./types.ts";
import { JsonRpcProvider } from "ethers";

export async function getTokenBalance(wallet: string, token: string, chain: Chain): Promise<bigint> {
  const { chainId, nativeToken, rpcUrl } = SUPPORTED_CHAINS[chain];
  const client = createPublicClient({
    chain: { id: chainId, name: chain, nativeCurrency: { name: nativeToken, symbol: nativeToken, decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } },
    transport: http(rpcUrl),
  });

  return client.readContract({
    abi: erc20Abi,
    address: token as `0x${string}`,
    functionName: "balanceOf",
    args: [wallet as `0x${string}`],
  });
}

const CONFIRMATIONS: Record<Chain, number> = { base: 4, polygon: 8, arbitrum:3 };

export async function waitForConfirmations({
  provider,
  txBlockNumber,
  chain,
  pollIntervalMs = 1500,
  timeoutMs = 60000,
}: {
  provider: JsonRpcProvider;
  txBlockNumber: number;
  chain: Chain;
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<void> {
  const target = txBlockNumber + CONFIRMATIONS[chain];
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await provider.getBlockNumber() >= target) return;
    await new Promise((res) => setTimeout(res, pollIntervalMs));
  }

  throw new Error(`Timeout: ${CONFIRMATIONS[chain]} confirmations not reached`);
}
