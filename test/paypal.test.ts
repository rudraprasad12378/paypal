import { createPayPalOrder, capturePayPalOrder } from "../lib/paypal.ts";

console.log("=== RUNNING PAYPAL SANDBOX ORDERS API v2 TEST ===");

async function test() {
  console.log("1. Creating PayPal Sandbox Order for $24.64...");
  const order = await createPayPalOrder({
    amount: 24.64,
    currency: "USD",
    description: "Ergonomic Vertical Mouse via Mandate AI Wallet",
    customId: "deal-test-99",
    productName: "Ergonomic Vertical Mouse",
  });

  console.log(`✔ Order Created: ID = ${order.orderId}, Status = ${order.status}, Mode = ${order.paymentMode}`);
  console.assert(order.orderId.length > 5, "Order ID should be non-empty");

  console.log("\n2. Capturing PayPal Sandbox Order...");
  const capture = await capturePayPalOrder(order.orderId);
  console.log(`✔ Order Captured: ID = ${capture.orderId}, Capture ID = ${capture.captureId}, Status = ${capture.status}`);
  console.assert(capture.status === "COMPLETED", "Capture status should be COMPLETED");
  console.log("\n=== PAYPAL SANDBOX INTEGRATION VERIFIED SUCCESSFULLY ===");
}

test().catch((err) => {
  console.error("PayPal test failed:", err);
  process.exit(1);
});

