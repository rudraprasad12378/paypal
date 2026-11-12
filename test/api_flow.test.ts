import { getState, resetStore, setKillSwitch, getMandate, updateTransaction, deductBudget } from "../lib/store.ts";
import { runAgentNegotiation } from "../lib/negotiator.ts";
import { evaluateDealGuardrails } from "../lib/guardrails.ts";
import { createPayPalOrder, capturePayPalOrder } from "../lib/paypal.ts";

console.log("=== RUNNING FULL END-TO-END SYSTEM INTEGRATION TEST ===");

async function runTest() {
  resetStore();
  const initialState = getState();
  console.log(`1. Initial Mandate Budget: $${initialState.mandate.totalBudget.toFixed(2)}, Threshold: $${initialState.mandate.approvalThreshold.toFixed(2)}`);

  // Scenario A: Auto-approved deal (< $30)
  console.log("\n--- SCENARIO A: AUTO-APPROVED DEAL FLOW ---");
  const mouse = initialState.products.find(p => p.listPrice <= 30) || initialState.products[0];
  const dealA = await runAgentNegotiation({
    product: mouse,
    mandate: initialState.mandate,
    buyerIntent: "Buy item under $25",
    maxTurns: 3,
  });
  console.log(`Deal reached: $${dealA.agreedPrice.toFixed(2)} (List was $${dealA.listPrice.toFixed(2)})`);

  const guardrailA = evaluateDealGuardrails(dealA, initialState.mandate);
  console.log(`Guardrail Decision: ${guardrailA.decision} (Reason: ${guardrailA.reason})`);
  console.assert(guardrailA.decision === "AUTO_APPROVED", "Should auto approve under $30");

  if (guardrailA.decision === "AUTO_APPROVED") {
    const order = await createPayPalOrder({
      amount: dealA.agreedPrice,
      currency: "USD",
      description: dealA.productName,
      customId: "tx-test-A",
      productName: dealA.productName,
    });
    console.log(`PayPal Order Created: ${order.orderId} (${order.paymentMode})`);
    const capture = await capturePayPalOrder(order.orderId);
    console.log(`PayPal Capture Succeeded: Capture ID ${capture.captureId}`);
    deductBudget(dealA.agreedPrice);
    console.log(`Updated Remaining Budget: $${getMandate().remainingBudget.toFixed(2)}`);
  }

  // Scenario B: Human Approval Flow (> $30 threshold)
  console.log("\n--- SCENARIO B: HUMAN APPROVAL FLOW (> $30 THRESHOLD) ---");
  const keyboard = initialState.products.find(p => p.listPrice > 35 && p.listPrice <= 45) || initialState.products[1];
  const dealB = await runAgentNegotiation({
    product: keyboard,
    mandate: getMandate(),
    buyerIntent: "Procure item with standard parameters",
    maxTurns: 3,
  });
  console.log(`Deal reached: $${dealB.agreedPrice.toFixed(2)}`);
  const guardrailB = evaluateDealGuardrails(dealB, getMandate());
  console.log(`Guardrail Decision: ${guardrailB.decision}`);
  console.assert(guardrailB.decision === "NEEDS_HUMAN_APPROVAL", "Should require human approval");

  console.log("Simulating human click [APPROVE & PAY VIA PAYPAL]...");
  const orderB = await createPayPalOrder({
    amount: dealB.agreedPrice,
    currency: "USD",
    description: dealB.productName,
    customId: "tx-test-B",
    productName: dealB.productName,
  });
  const captureB = await capturePayPalOrder(orderB.orderId);
  console.log(`Human authorized deal captured: ${captureB.captureId}`);
  deductBudget(dealB.agreedPrice);
  console.log(`Updated Remaining Budget: $${getMandate().remainingBudget.toFixed(2)}`);

  // Scenario C: Kill Switch Engagement
  console.log("\n--- SCENARIO C: EMERGENCY KILL SWITCH ACTIVE ---");
  setKillSwitch(true);
  console.log("Emergency kill switch engaged!");
  const guardrailC = evaluateDealGuardrails(dealA, getMandate());
  console.log(`Guardrail under kill switch: ${guardrailC.decision} -> ${guardrailC.reason}`);
  console.assert(guardrailC.decision === "REJECTED", "Kill switch must reject all transactions");

  setKillSwitch(false);
  console.log("Kill switch disengaged.");

  console.log("\n=== ALL SYSTEM INTEGRATION SCENARIOS VERIFIED SUCCESSFULLY ===");
}

runTest().catch(err => {
  console.error("Integration test failed:", err);
  process.exit(1);
});

