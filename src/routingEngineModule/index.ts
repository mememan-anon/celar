import { orchestrateRoutingFlow } from "./orchestrator.ts";

///dont use it refer to package.json how to start payment maodule manuallu
///never tested it yes!!!

export async function handleIncomingPayment(paymentId: string) {
  try {
    console.log(`[RoutingEngine] Handling payment: ${paymentId}`);
    await orchestrateRoutingFlow(paymentId);
    console.log(`[RoutingEngine] Completed: ${paymentId}`);
  } catch (error) {
    console.error(`[RoutingEngine] Failed to process payment ${paymentId}`, error);
    // Optional: log error to external system or alert
  }
}
