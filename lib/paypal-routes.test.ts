import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as createOrderRoute } from "../app/api/paypal/create-order/route";
import { POST as captureOrderRoute } from "../app/api/paypal/capture-order/route";
import {
  resetStore,
  getMandate,
  setKillSwitch,
  addTransaction,
  getTransactions,
} from "./store";

describe("PayPal Orders API Routes (/api/paypal/create-order & capture-order)", () => {
  beforeEach(() => {
    resetStore();
    // Ensure simulation credentials
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_SECRET;
  });

  it("rejects create-order when Emergency Kill Switch is engaged", async () => {
    setKillSwitch(true);

    const tx = addTransaction({
      id: "tx-test-killswitch",
      dealId: "deal-1",
      productId: "gadget-1",
      productName: "Mechanical Keyboard",
      category: "gadgets",
      sellerName: "Direct Merchant",
      amount: 35.0,
      currency: "USD",
      status: "APPROVED",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-1",
        decision: "AUTO_APPROVED",
        passedAllBlockers: true,
        reason: "Conforms to policy",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id }),
    });

    const res = await createOrderRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.killSwitchActive).toBe(true);
    expect(data.error).toContain("Emergency Kill Switch is ACTIVE");
  });

  it("rejects create-order for guardrail-blocked transactions", async () => {
    const tx = addTransaction({
      id: "tx-test-blocked",
      dealId: "deal-blocked",
      productId: "gadget-1",
      productName: "Overpriced Item",
      category: "gadgets",
      sellerName: "Direct Merchant",
      amount: 500.0,
      currency: "USD",
      status: "REJECTED_GUARDRAIL",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-blocked",
        decision: "REJECTED",
        passedAllBlockers: false,
        reason: "Price exceeds cap",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id }),
    });

    const res = await createOrderRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Security Violation");
  });

  it("rejects create-order for pending transactions when user has not approved", async () => {
    const tx = addTransaction({
      id: "tx-test-pending",
      dealId: "deal-pending",
      productId: "gadget-1",
      productName: "High Value Gadget",
      category: "gadgets",
      sellerName: "Direct Merchant",
      amount: 40.0,
      currency: "USD",
      status: "PENDING_APPROVAL",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-pending",
        decision: "NEEDS_HUMAN_APPROVAL",
        passedAllBlockers: true,
        reason: "Price exceeds threshold",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id, userApproved: false }),
    });

    const res = await createOrderRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.needsApproval).toBe(true);
  });

  it("successfully creates PayPal order when user approves a pending transaction", async () => {
    const tx = addTransaction({
      id: "tx-test-approved-by-user",
      dealId: "deal-user-app",
      productId: "gadget-1",
      productName: "Gaming Mouse",
      category: "gadgets",
      sellerName: "Direct Merchant",
      amount: 32.0,
      currency: "USD",
      status: "PENDING_APPROVAL",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-user-app",
        decision: "NEEDS_HUMAN_APPROVAL",
        passedAllBlockers: true,
        reason: "Needs approval",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id, userApproved: true }),
    });

    const res = await createOrderRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.orderId).toMatch(/^ORD-SANDBOX-/);
    expect(data.approvalUrl).toBeDefined();

    // Verify state transition to PAYMENT_PROCESSING
    const updated = getTransactions().find((t) => t.id === tx.id);
    expect(updated?.status).toBe("PAYMENT_PROCESSING");
    expect(updated?.paypalOrderId).toBe(data.orderId);
  });

  it("captures authorized PayPal order, deducts budget, and updates status", async () => {
    const initialBudget = getMandate().remainingBudget;

    const tx = addTransaction({
      id: "tx-test-capture",
      dealId: "deal-capture",
      productId: "book-1",
      productName: "TypeScript Handbook",
      category: "books",
      sellerName: "Direct Merchant",
      amount: 25.0,
      currency: "USD",
      status: "PAYMENT_PROCESSING",
      paypalOrderId: "ORD-SANDBOX-CAPTURE-123",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-capture",
        decision: "AUTO_APPROVED",
        passedAllBlockers: true,
        reason: "Within budget",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({
        orderId: "ORD-SANDBOX-CAPTURE-123",
        transactionId: tx.id,
      }),
    });

    const res = await captureOrderRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("COMPLETED");
    expect(data.captureId).toMatch(/^CAP-SANDBOX-/);

    // Verify transaction updated to PAYPAL_CAPTURED
    const capturedTx = getTransactions().find((t) => t.id === tx.id);
    expect(capturedTx?.status).toBe("PAYPAL_CAPTURED");
    expect(capturedTx?.paypalCaptureId).toBe(data.captureId);

    // Verify budget deducted
    const postMandate = getMandate();
    expect(postMandate.remainingBudget).toBe(Number((initialBudget - 25.0).toFixed(2)));
  });

  it("handles capture idempotently if already captured", async () => {
    const tx = addTransaction({
      id: "tx-already-captured",
      dealId: "deal-done",
      productId: "gadget-1",
      productName: "Desk Lamp",
      category: "gadgets",
      sellerName: "Direct Merchant",
      amount: 20.0,
      currency: "USD",
      status: "PAYPAL_CAPTURED",
      paypalOrderId: "ORD-SANDBOX-ALREADY-DONE",
      paypalCaptureId: "CAP-SANDBOX-PRIOR",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-done",
        decision: "AUTO_APPROVED",
        passedAllBlockers: true,
        reason: "Passed",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({
        orderId: "ORD-SANDBOX-ALREADY-DONE",
        transactionId: tx.id,
      }),
    });

    const res = await captureOrderRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.alreadyCaptured).toBe(true);
    expect(data.captureId).toBe("CAP-SANDBOX-PRIOR");
  });
});

