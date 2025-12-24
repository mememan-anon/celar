import type { ChainAdapter, FeeSplit } from "../utils/types";
// import erc20Abi from "../abis/erc20.json" with { type: "json" };
import { erc20Abi } from "viem";
import { Contract } from "ethers";
import { parseUnits, formatUnits } from "ethers";


export async function calculateFeeSplit(
  adapter: ChainAdapter,
  token: string,
  amount: string,
  percent: number = 1
): Promise<FeeSplit & { pspUnits: bigint; treasuryUnits: bigint }> {
  const provider = adapter.getProvider();
  const contract = new Contract(token, erc20Abi, provider);
  const decimals: number = await contract.decimals();

  const totalUnits = parseUnits(amount, decimals);
  const feeUnits = (totalUnits * BigInt(percent)) / 100n;
  const pspUnits = totalUnits - feeUnits;

  return {
    total: amount,
    percent,
    treasury: formatUnits(feeUnits, decimals),
    psp: formatUnits(pspUnits, decimals),
    pspUnits,
    treasuryUnits: feeUnits,
  };
}
