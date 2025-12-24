import { encodeFunctionData, erc20Abi, getAbiItem, http, parseEventLogs } from "viem";
import type { Chain, PaymentSweepInput } from "../utils/types.ts";
import { calculateFeeSplit } from "../tx/feeSplitter.ts";
import { getChainAdapter } from "../adapters/index.ts";
import { SUPPORTED_CHAINS } from "../utils/chains.ts";
import dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import { createBicoPaymasterClient, createNexusClient, toNexusAccount } from "@biconomy/abstractjs";
import { baseSepolia, polygonAmoy, arbitrumSepolia } from "viem/chains";

dotenv.config();

const privateKey = process.env.TREASURY_PRIVATE_KEY!;
const owner = privateKeyToAccount(privateKey as `0x${string}`);

// URLs and Chain Mapping
const BUNDLER_URLS: Record<Chain, string> = {
  base: process.env.BASE_BICONOMY_BUNDLER_URL!,
  polygon: process.env.POLYGON_BICONOMY_BUNDLER_URL!,
  arbitrum: process.env.ARBITRUM_BICONOMY_BUNDLER_URL!,
};

const PAYMASTER_URLS: Record<Chain, string> = {
  base: process.env.BASE_BICONOMY_PAYMASTER_URL!,
  polygon: process.env.POLYGON_BICONOMY_PAYMASTER_URL!,
  arbitrum: process.env.ARBITRUM_BICONOMY_PAYMASTER_URL!,
};

const CHAIN_OBJECTS: Record<Chain, any> = {
  base: baseSepolia,
  polygon: polygonAmoy,
  arbitrum: arbitrumSepolia,
};
export async function generateKernelWallet(paymentId: string, chain: Chain) {
  const saltIndex = BigInt("0x" + Buffer.from(paymentId).toString("hex").slice(0, 16));

  const nexusAccount = await toNexusAccount({
    signer: owner,
    transport: http(),
    chain: CHAIN_OBJECTS[chain],
    index: saltIndex, 
  });

  const nexusClient = createNexusClient({
    account: nexusAccount,
    transport: http(BUNDLER_URLS[chain]),
  });

  return nexusClient.account.address;
}

export async function settleSmartWalletPayment({
  id,
  intermediary_wallet,
  token_address,
  chain,
  amount,
  psp_wallet
}: PaymentSweepInput) {
  console.log(`\n[🚀 START] settleSmartWalletPayment for ${id} on ${chain}`);
  
  const saltIndex = BigInt("0x" + Buffer.from(id).toString("hex").slice(0, 16));
  console.log(`[🔢] Salt index for ID ${id}:`, saltIndex.toString());

  try {
  const adapter = getChainAdapter(chain);
  const split = await calculateFeeSplit(adapter, token_address, amount, 1);
  console.log(`[💸] Fee split => PSP: ${split.psp}, Treasury: ${split.treasury}`);

  const TREASURY_WALLET = SUPPORTED_CHAINS[chain].treasuryWallet as `0x${string}`;

  const nexusAccount = await toNexusAccount({
    signer: owner,
    transport: http(),
    chain: CHAIN_OBJECTS[chain],
    index: saltIndex, 
  });
  console.log(`[🔐] Smart Account Address:`, nexusAccount.address);

  const nexusClient = createNexusClient({
    account: nexusAccount,
    transport: http(BUNDLER_URLS[chain]),
    paymaster: createBicoPaymasterClient({ paymasterUrl: PAYMASTER_URLS[chain] }),
  });
  console.log(`[🔌] Nexus client setup complete with bundler & paymaster`);

  const calls = [
    {
      to: token_address as `0x${string}`,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [psp_wallet as `0x${string}`, split.pspUnits],
      }),
      value: 0n
    },
    {
      to: token_address as `0x${string}`,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [TREASURY_WALLET, split.treasuryUnits],
      }),
      value: 0n
    }
  ];

  console.log(`[📦] Prepared ${calls.length} call(s):`);
  calls.forEach((call, i) => {
    console.log(`  [#${i + 1}] To: ${call.to}, Value: ${call.value}, Data length: ${call.data.length}`);
  });

  const hash = await nexusClient.sendUserOperation({ calls });
  console.log(`[📨] UserOperation submitted. Hash: ${hash}`);

  const receipt = await nexusClient.waitForUserOperationReceipt({ hash });
  console.log(`[✅ CONFIRMED] Tx confirmed. UserOp Receipt:`, receipt.receipt.transactionHash, `(${receipt.receipt.status ? "Success" : "Failed"})`);

  const transferEvent = getAbiItem({ abi: erc20Abi, name: "Transfer" });
  
  // Decode logs from receipt
  const decodedLogs = parseEventLogs({
    abi: [transferEvent],
    logs: receipt.receipt.logs,
  });

  console.log(`[🪵] Decoded ${decodedLogs.length} logs`);

  for (const log of decodedLogs) {
    console.log(`[🧾 LOG] Event: ${log.eventName}, From: ${log.args.from}, To: ${log.args.to}, Amount: ${log.args.value}`);
  }
  
  // Look for the two required transfers
  let pspTransferFound = false;
  let treasuryTransferFound = false;

  for (const log of decodedLogs) {
    if (log.eventName !== "Transfer") continue;
    const to = log.args.to.toLowerCase();

    if (to === psp_wallet.toLowerCase()) pspTransferFound = true;
    if (to === TREASURY_WALLET.toLowerCase()) treasuryTransferFound = true;
  }

   // ✅ Better logging
   if (!pspTransferFound || !treasuryTransferFound) {
    console.warn(`[⚠️] Decoded logs did NOT contain expected transfers`);
    console.warn(`→ PSP match: ${pspTransferFound}`);
    console.warn(`→ Treasury match: ${treasuryTransferFound}`);
    throw new Error("Token transfer to PSP or Treasury did not complete");
  }

  return {
    txHash: receipt.receipt.transactionHash,
    pspAmount: split.psp,
    treasuryAmount: split.treasury,
  };
} catch (error) {
  console.error(`Settlement failed for payment ${id}:`, error);
  throw error;
}}

