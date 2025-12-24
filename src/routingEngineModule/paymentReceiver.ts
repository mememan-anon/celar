import {
  JsonRpcProvider,
  Contract,
  parseUnits,
  formatUnits,
  zeroPadValue,
  Interface,
  type Filter,
  type Log,
  type LogDescription,
} from "ethers";
import { erc20Abi } from "viem";
import { ADAPTER_REGISTRY } from "./adapters/index.ts";
import { orchestrateRoutingFlow } from "./orchestrator.ts";
import {
  getConfirmedUnsettledPayments,
  getUnconfirmedPayments,
  isPaymentAlreadyConfirmed,
  isTargetAlreadyProcessed,
  markPaymentAsConfirmed,
  markPaymentAsMismatched,
  markRouteAsUsed,
  recordMismatchedPayment,
  cancelStalePendingPayments,
  markPendingPaymentAsFailed
} from "./utils/paymentService.ts";
import { recordTxAttempt } from "./tx/txRecorder.ts";
import type { MismatchedPaymentStatus, PendingPayment } from "./utils/types.ts";
import { getTokenBalance, waitForConfirmations } from "./utils/utils.ts";
import { generateKernelWallet } from "./smartwallet/settleSmartWallet.ts";
import { webhookOnConfirmed, webhookOnFailure, webhookOnMismatch } from "./utils/webhookHelpers.ts";
import { mockRiskEngine } from "../complianceModule/riskEngine.ts";

const POLL_INTERVAL_MS = 5000;
const MAX_RANGE = 9500;
let staleCheckCounter = 0;
const activeListeners = new Set<string>();
const mismatchLocks = new Set<string>();
const confirmLocks = new Set<string>();

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function pollForTransferEvents(
  filter: Filter,
  provider: JsonRpcProvider,
  fromBlock: number,
  onLog: (log: Log) => Promise<void>
) {
  let lastBlock = fromBlock;

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (lastBlock >= currentBlock) return;

      let start = lastBlock + 1;

      while (start <= currentBlock) {
        const end = Math.min(start + MAX_RANGE - 1, currentBlock);

        try {
          const logs = await provider.getLogs({
            ...filter,
            fromBlock: start,
            toBlock: end,
          });

          for (const log of logs) {
            await onLog(log);
          }
        } catch (err) {
          console.error(`[pollForTransferEvents] Failed block range ${start}-${end}:`, err);
        }

        start = end + 1;
      }

      lastBlock = currentBlock;
    } catch (err) {
      console.error("[pollForTransferEvents] Failed outer loop:", err);
    }
  }, POLL_INTERVAL_MS);
}

async function startListener(payment: PendingPayment) {
  const {
    id,
    chain,
    currency,
    amount,
    token_address,
    intermediary_wallet,
    created_block_number,
    status
  } = payment;

    // Early bailout
    if (activeListeners.has(id)) return;
    activeListeners.add(id);

  const adapter = ADAPTER_REGISTRY[chain];
  if (!adapter || !token_address || !intermediary_wallet) {
    console.warn(`[⚠️] Skipping ${id}: missing chain adapter or addresses`);
    return;
  }

  const provider: JsonRpcProvider = adapter.getProvider();
  const iface = new Interface(erc20Abi);
  const token = new Contract(token_address, erc20Abi, provider);
  const decimals = await token.decimals();
  const minAmount = parseUnits(amount, decimals);

  const topicFilter: Filter = {
    address: token_address,
    topics: [
      iface.getEvent("Transfer")!.topicHash,
      null,
      zeroPadValue(intermediary_wallet, 32),
    ],
  };

    // Handle confirmed or settling with balance
    if (["confirmed", "settling"].includes(status)) {
      const smartWalletAddress = await generateKernelWallet(id, chain);
      const balance = await getTokenBalance(smartWalletAddress, token_address, chain);
      if (balance > 0n) {
        console.log(`[⚙️] Attempting settlement for payment ${id} (${status})...`);
        await orchestrateRoutingFlow(id).catch((err) =>
          console.error(`Settlement failed for ${id}:`, err)
        );
      } else {
        console.log(`[⏸] Payment ${id} has status '${status}' but no funds found. Skipping settlement.`);
      }
      return;
    }

  console.log(`[🔁] Polling for pending payment ${id} on ${chain} for amount: ${amount} from ${intermediary_wallet}`);

  await pollForTransferEvents(topicFilter, provider, created_block_number, async (log: Log) => {
    try {
      const parsed = iface.parseLog(log) as LogDescription;
      const value = parsed.args[2] as bigint;
      const sender = parsed.args[0] as string;
      //check no of confirmations b4 confirming payment
      const txBlock = log.blockNumber;
      await waitForConfirmations({
        provider,
        txBlockNumber: txBlock,
        chain
     });

    if (!value) return;

    ///kyt check after value is confirmed
    const kytVerdict = await mockRiskEngine(payment);
    if (kytVerdict.risk_level === "high") {
      console.warn(`[KYT] Payment ${id} blocked due to KYT risk`);
      const reasonFlags = kytVerdict.flags.join(", ");
      const reason = `KYT check failed (high risk): ${reasonFlags}`;
      await markPendingPaymentAsFailed(id);
    await webhookOnFailure(payment.psp_id, id, {
      reason,
    });
    return;
  }

if (value !== minAmount) {
  const mismatchType: MismatchedPaymentStatus =
    value < minAmount ? "underpaid" : "overpaid";

  const txHash = log.transactionHash;
  if (mismatchLocks.has(txHash)) return; 
  mismatchLocks.add(txHash);

    try {
      await markPaymentAsMismatched(id, sender);
      await recordMismatchedPayment({
        paymentId: id,
        txHash,
        sender,
        expectedAmount: minAmount.toString(),
        receivedAmount: value.toString(),
        status: mismatchType,
      });

      await webhookOnMismatch(payment.psp_id, id, {
        sender,
        expected: formatUnits(minAmount, decimals),
        received: formatUnits(value, decimals),
        txhash: txHash,
      });

      console.warn(`Payment ${id} is ${mismatchType}. Expected ${minAmount}, got ${value}. Marked as mismatched.`);
      return;
    } catch (err) {
      console.error(` Failed to handle mismatch for ${id}:`, err);
    } finally {
      mismatchLocks.delete(txHash); 
    }
  }

  if (confirmLocks.has(id)) return;
      confirmLocks.add(id);

      try {
        const alreadyConfirmed = await isPaymentAlreadyConfirmed(id);
        if (alreadyConfirmed) return;

        console.log(`[✅] Payment ${id} received: ${formatUnits(value, decimals)} ${currency} from ${sender}`);
        await markPaymentAsConfirmed(id, sender);

        await webhookOnConfirmed(payment.psp_id, id, {
          sender,
          amount: formatUnits(value, decimals),
          currency,
          chain,
          txhash: log.transactionHash,
        });

        await markRouteAsUsed({ paymentId: id, txHash: log.transactionHash });

        if (!isTargetAlreadyProcessed(id, "incoming")) {
          await recordTxAttempt({
            paymentId: id,
            chain,
            token: token_address,
            amount,
            txHash: log.transactionHash,
            attempt: 1,
            target: "incoming",
            success: true,
          });
        }

        await orchestrateRoutingFlow(id);
        activeListeners.delete(id);
      } catch (err) {
        console.error(`Settlement failed for ${id}:`, err);
      } finally {
        confirmLocks.delete(id);
      }
    } catch (err) {
      console.error(`Failed to process log for ${id}:`, err);
    }
  });

  activeListeners.add(id);
}

async function pollForNewPayments() {
  console.log(`[👀] Starting multichain listener engine...`);

  while (true) {
    try {
      ///check stale payments once every 12 loops
      //one loop is 5 seconds, so its every 60 seconds
      if (staleCheckCounter++ % 12 === 0) {
        cancelStalePendingPayments();
      }
      const pending = getUnconfirmedPayments().map((p) => ({ ...p, status: "pending" }) as PendingPayment);
      const confirmedOrSettling = getConfirmedUnsettledPayments().map((p) => ({ ...p, status: p.status as "confirmed" | "settling" }) as PendingPayment);
      const all = [...pending, ...confirmedOrSettling];

      for (const payment of all) {
        if (!activeListeners.has(payment.id)) {
          startListener(payment).catch((err) =>
            console.error(`Listener setup failed for payment ${payment.id}:`, err)
          );
        }
      }
    } catch (err) {
      console.error(`Polling error:`, err);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

// Entry point
pollForNewPayments().catch((err) => {
  console.error(`Fatal error:`, err);
  process.exit(1);
});
