import { 
  getPaymentById, 
  isTargetAlreadyProcessed, 
  markPaymentAsSettledFailed, 
  markPaymentAsSettled,
  markPaymentAsSettling
} from "./utils/paymentService.ts";
import { recordTxAttempt } from "./tx/txRecorder.ts";
import { settleSmartWalletPayment } from "./smartwallet/settleSmartWallet.ts";
import type { Chain } from "./utils/types.ts";
import { webhookOnSettled, webhookOnSettleFailed } from "./utils/webhookHelpers.ts";

const activeSettlements = new Set<string>();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function orchestrateRoutingFlow(paymentId: string) {
  if (activeSettlements.has(paymentId)) {
    console.log(`⏳ Skipping ${paymentId}: already being settled.`);
    return;
  }
  activeSettlements.add(paymentId);

  try {
    const payment = getPaymentById(paymentId);
    if (!payment) throw new Error("Payment not found");

    if (["settled", "settled_failed"].includes(payment.status)) return;

    await markPaymentAsSettling(paymentId);

    const { amount, chain, token_address, intermediary_wallet, psp_wallet } = payment;
    const selectedChain = chain as Chain;

      // // Prevent duplicate settlement attempts
    if (isTargetAlreadyProcessed(paymentId, "psp")) {
      console.log(`PSP already routed for ${paymentId}, skipping`);
      await markPaymentAsSettled(paymentId);
      return;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await settleSmartWalletPayment({
          id: paymentId,
          intermediary_wallet,
          token_address,
          chain: selectedChain,
          amount,
          psp_wallet,
        });

        await recordTxAttempt({
          paymentId,
          chain: selectedChain,
          token: token_address,
          amount: result.pspAmount,
          txHash: result.txHash,
          attempt,
          target: "psp",
          success: true,
          meta: { treasuryFee: result.treasuryAmount },
        });

        await markPaymentAsSettled(paymentId);
        await webhookOnSettled(payment.psp_id, paymentId, {
          psp_amount: result.pspAmount,
          treasury_fee: result.treasuryAmount,
          chain,
          tx_hash: result.txHash,
        });

        console.log(`[✅] Payment ${paymentId} settled via ${selectedChain} → PSP tx ${result.txHash}`);
        return;

      } catch (err) {
        const errorMessage = (err as any)?.message || "Routing to PSP failed";

        // Only record the final failed attempt
        if (attempt === 3) {
          await recordTxAttempt({
            paymentId,
            chain: selectedChain,
            token: token_address,
            amount,
            txHash: undefined,
            attempt,
            target: "psp",
            success: false,
            meta: { error: errorMessage },
          });

          console.error(`[❌] All attempts failed for ${paymentId}. Marking as settled_failed.`);
          await markPaymentAsSettledFailed(paymentId);
          await webhookOnSettleFailed(payment.psp_id, paymentId, {
            reason: errorMessage,
          });
        } else {
          console.warn(`[⚠️] Attempt ${attempt} failed for ${paymentId}: ${errorMessage}`);
          console.log(`⏳ Waiting for 20 seconds before retrying...`);
          await sleep(20000);
        }
      }
    }
  } finally {
    activeSettlements.delete(paymentId);
  }
}
