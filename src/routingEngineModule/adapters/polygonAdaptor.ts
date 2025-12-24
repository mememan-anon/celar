import {
  JsonRpcProvider,
  Contract,
} from "ethers";
import { erc20Abi } from "viem";
import { SUPPORTED_CHAINS } from "../utils/chains.ts";
import type { ChainAdapter } from "../utils/types.ts";
import { checkRpcHealth, estimateAvgBlockTime, estimateFeeUSD } from "./adapterUtils.ts";
import { DUMMY_TO } from "../utils/constants.ts";

// Reuse a single provider instance
const provider = new JsonRpcProvider(SUPPORTED_CHAINS.polygon.rpcUrl);
//fund it with token for gas estimation like 1 usd

export const polygonAdapter: ChainAdapter = {
  async getEstimatedFee(amount, currency = "USDC") {
    const cfg = SUPPORTED_CHAINS.polygon;
    const token = currency === "USDT" ? cfg.usdtAddress! : cfg.usdcAddress;
    const tokenContract = new Contract(token, erc20Abi, provider);
    const decimals = await tokenContract.decimals();

  return estimateFeeUSD({
    provider,
    tokenAddress: token,
    intermediaryWallet: cfg.intermediaryWallet??DUMMY_TO,
    priceFeedAddress: cfg.priceFeedAddress!,
    currencyDecimals: decimals,
    fallbackGasLimit: 65000n
  });
},

  getEstimatedTime() {
    return estimateAvgBlockTime(provider);
  },

  checkHealth() {
    return checkRpcHealth(provider);
  },
  
  getProvider(): JsonRpcProvider {
    return provider;
  },
  
  getConfig() {
    const cfg = SUPPORTED_CHAINS.polygon;
    return {
      usdcAddress: cfg.usdcAddress!,
      usdtAddress: cfg.usdtAddress!,
      priceFeedAddress: cfg.priceFeedAddress!,
      rpcUrl: cfg.rpcUrl!,
    };
  }
};
