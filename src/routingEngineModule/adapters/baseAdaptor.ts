import {
  JsonRpcProvider,
  Contract
} from "ethers";
import { erc20Abi } from "viem";
import { SUPPORTED_CHAINS } from "../utils/chains.ts";
import type { ChainAdapter } from "../utils/types.ts";
import { checkRpcHealth, estimateAvgBlockTime, estimateFeeUSD } from "./adapterUtils.ts";
import { DUMMY_TO } from "../utils/constants.ts";

// ✅ Shared provider instance for Base chain
const provider = new JsonRpcProvider(SUPPORTED_CHAINS.base.rpcUrl);

export const baseAdapter: ChainAdapter = {
  async getEstimatedFee( amount, currency = "USDC") {
    const cfg = SUPPORTED_CHAINS.base;
    const token = currency === "USDT" ? cfg.usdtAddress! : cfg.usdcAddress;
    const tokenContract = new Contract(token, erc20Abi, provider);
    const decimals: number = await tokenContract.decimals();
   
    return estimateFeeUSD({
      provider,
      tokenAddress: token,
      intermediaryWallet: cfg.intermediaryWallet??DUMMY_TO,
      priceFeedAddress: cfg.priceFeedAddress!,
      currencyDecimals: decimals,
      fallbackGasLimit: 60000n,
      fallbackGasApi: "https://base.blockscout.com/api/v1/gas-price-oracle"
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
    const cfg = SUPPORTED_CHAINS.base;
    return {
      usdcAddress: cfg.usdcAddress!,
      usdtAddress: cfg.usdtAddress!,
      priceFeedAddress: cfg.priceFeedAddress!,
      rpcUrl: cfg.rpcUrl!,
    };
  }  

};
