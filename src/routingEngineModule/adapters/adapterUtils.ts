import {
    JsonRpcProvider,
    Contract,
    Interface,
    parseUnits,
    formatUnits
  } from "ethers";
  import { erc20Abi } from "viem";
  import { DUMMY_AMOUNT, DUMMY_FROM } from "../utils/constants.ts";
  
  export async function estimateFeeUSD({
    provider,
    tokenAddress,
    intermediaryWallet,
    priceFeedAddress,
    currencyDecimals,
    fallbackGasLimit,
    fallbackGasApi,
  }: {
    provider: JsonRpcProvider;
    tokenAddress: string;
    intermediaryWallet: string;
    priceFeedAddress: string;
    currencyDecimals: number;
    fallbackGasLimit: bigint;
    fallbackGasApi?: string;
  }): Promise<string> {
    const iface = new Interface(erc20Abi);
    const amountUnits = parseUnits(DUMMY_AMOUNT, currencyDecimals);
    const data = iface.encodeFunctionData("transfer", [intermediaryWallet, amountUnits]);
  
    let gasLimit: bigint;
    let gasPrice: bigint;
  
    try {
      gasLimit = await provider.estimateGas({
        from: DUMMY_FROM,
        to: tokenAddress,
        data
      });
  
      const feeData = await provider.getFeeData();
      if (!feeData.gasPrice) throw new Error("Missing gasPrice");
      gasPrice = feeData.gasPrice;
    } catch (err) {
      console.warn(`[⚠️] Gas estimation failed, using fallback for ${tokenAddress}`);
  
      gasLimit = fallbackGasLimit;
  
      if (fallbackGasApi) {
        try {
          const res = await fetch(fallbackGasApi);
          const json = await res.json();
          const gwei = Number(json.fast ?? json.standard ?? 30);
          gasPrice = BigInt(Math.floor(gwei)) * 1_000_000_000n;
        } catch {
          gasPrice = 30n * 1_000_000_000n;
        }
      } else {
        const feeData = await provider.getFeeData();
        if (!feeData.gasPrice) throw new Error("No fallback gasPrice");
        gasPrice = feeData.gasPrice;
      }
    }
  
    const feeInWei = gasPrice * gasLimit;
  
    const priceFeed = new Contract(
      priceFeedAddress,
      ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
      provider
    );
    const [, answer] = await priceFeed.latestRoundData();
    const usdPrice = BigInt(answer as bigint);
  
    const divisor = 10n ** (18n + 8n - BigInt(currencyDecimals));
    const feeTokenUnits = (feeInWei * usdPrice) / divisor;
  
    return formatUnits(feeTokenUnits, currencyDecimals);
  }
  
  export async function estimateAvgBlockTime(provider: JsonRpcProvider): Promise<number> {
    const latest = await provider.getBlock("latest");
    const prev = await provider.getBlock(latest!.number - 10);
    return (latest!.timestamp - prev!.timestamp) / 10;
  }
  
  export async function checkRpcHealth(provider: JsonRpcProvider): Promise<number> {
    const start = Date.now();
    try {
      await provider.getBlockNumber();
      const latency = Date.now() - start;
      const maxExpected = 1000;
      const cappedLatency = Math.min(latency, maxExpected);
      const health = Math.round((1 - cappedLatency / maxExpected) * 100);
      return health
    } catch {
      return 0;
    }
  }