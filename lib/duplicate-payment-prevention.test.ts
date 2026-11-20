import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as negotiateRoute } from "../app/api/negotiate/route";
import { POST as createOrderRoute } from "../app/api/paypal/create-order/route";
import { POST as captureOrderRoute } from "../app/api/paypal/capture-order/route";
import { POST as approveRoute } from "../app/api/approve/route";
import {
  resetStore,
  getMandate,
  getTransactions,
  getState,
  addTransaction,
  logNegotiationRun,
} from "./store";

// Helper to consume SSE stream from negotiateRoute
async function readCompleteSSE(response: Response): Promise<{ finalResult: any; messages: any[] }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No body on SSE response");
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: any = null;
  const messages: any[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      if (chunk.startsWith("data: ")) {
        const jsonStr = chunk.replace(/^data:\s*/, "").trim();
        try {
          const evt = JSON.parse(jsonStr);
          if (evt.type === "message") {
            messages.push(evt);
          } else if (evt.type === "complete") {
            finalResult = evt.result;
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }

  return { finalResult, messages };
}

describe("Regression Suite: Duplicate PayPal Transactions & Payment Safety", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    resetStore();
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_SECRET;
  });

  afterEach(() => {
    if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  // TEST 1: One product selection runs dual negotiation (both unguarded and guarded).
  // Verifies that only ONE captured transaction is recorded and budget is deducted exactly once.
  it("Test 1: One product selection with both agents negotiating produces exactly ONE guarded payment and NO unguarded payment", async () => {
    const initialBudget = getMandate().remainingBudget;

    // Concurrently dispatch both agents (simulating the SplitScreenArena dual execution)
    const unguardedReq = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productId: "book-1",
        productName: "Clean Code Handbook",
        category: "books",
        listPrice: 28.0,
        minPrice: 22.0,
        mode: "unguarded",
        attackMode: false,
      }),
    });

    const guardedReq = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productId: "book-1",
        productName: "Clean Code Handbook",
        category: "books",
        listPrice: 28.0,
        minPrice: 22.0,
        mode: "guarded",
        attackMode: false,
      }),
    });

    const [unguardedRes, guardedRes] = await Promise.all([
      negotiateRoute(unguardedReq),
      negotiateRoute(guardedReq),
    ]);

    const [ungData, grdData] = await Promise.all([
      readCompleteSSE(unguardedRes),
      readCompleteSSE(guardedRes),
    ]);

    // Both agents negotiated and completed
    expect(ungData.messages.length).toBeGreaterThan(0);
    expect(grdData.messages.length).toBeGreaterThan(0);
    expect(ungData.finalResult.status).toBe("approved");
    expect(grdData.finalResult.status).toBe("approved");

    // Guarded result has a valid transactionId; Unguarded simulation does NOT
    expect(grdData.finalResult.transactionId).toBeDefined();
    expect(ungData.finalResult.transactionId).toBeUndefined();

    // Verify Transaction Ledger: Exactly ONE transaction recorded in total
    const transactions = getTransactions();
    expect(transactions.length).toBe(1);

    const capturedTx = transactions[0];
    expect(capturedTx.id).toBe(grdData.finalResult.transactionId);
    expect(capturedTx.status).toBe("PAYPAL_CAPTURED");
    expect(capturedTx.amount).toBe(grdData.finalResult.finalPrice);
    expect(capturedTx.paypalOrderId).toBeDefined();
    expect(capturedTx.paypalCaptureId).toBeDefined();

    // Verify that NO unguarded transaction was added to the ledger
    const unguardedTxs = transactions.filter((t) => t.productName.includes("UNGUARDED") || t.id === ungData.finalResult.transactionId);
    expect(unguardedTxs.length).toBe(0);

    // Verify budget deducted EXACTLY once for the guarded purchase
    const finalMandate = getMandate();
    const expectedBudget = Number((initialBudget - grdData.finalResult.finalPrice).toFixed(2));
    expect(finalMandate.remainingBudget).toBe(expectedBudget);
  });

  // TEST 2: Server-side validation rejects payment creation for unguarded runs
  it("Test 2: Server-side validation rejects create-order for unguarded run IDs with HTTP 403", async () => {
    // Record an unguarded simulation run
    const unguardedRunId = "run-unguarded-exploit-1";
    logNegotiationRun({
      id: unguardedRunId,
      timestamp: new Date().toISOString(),
      productId: "gadget-1",
      productName: "Mechanical Keyboard",
      category: "gadgets",
      mode: "unguarded",
      attackMode: true,
      listPrice: 42.0,
      finalPrice: 500.0,
      savings: 0,
      status: "approved",
      reasons: ["Unguarded mode: guardrails skipped."],
      roundsCount: 4,
    });

    // Attempt to create a PayPal order using the unguarded runId
    const req = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ runId: unguardedRunId, userApproved: true }),
    });

    const res = await createOrderRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unguarded simulation runs cannot create PayPal orders");

    // Ensure no transactions were created
    expect(getTransactions().length).toBe(0);
  });

  // TEST 3: Server-side validation rejects capture for unguarded simulation transactions
  it("Test 3: Server-side validation rejects capture-order for unguarded simulation runs with HTTP 403", async () => {
    const unguardedRunId = "run-unguarded-capture-test";
    logNegotiationRun({
      id: unguardedRunId,
      timestamp: new Date().toISOString(),
      productId: "gadget-2",
      productName: "Wireless Mouse",
      category: "gadgets",
      mode: "unguarded",
      attackMode: false,
      listPrice: 25.0,
      finalPrice: 22.0,
      savings: 3.0,
      status: "approved",
      reasons: ["Unguarded mode"],
      roundsCount: 3,
    });

    // Artificially simulate a transaction claiming to link to an unguarded run
    const tx = addTransaction({
      id: "tx-unguarded-rogue",
      dealId: unguardedRunId,
      productId: "gadget-2",
      productName: "Wireless Mouse",
      category: "gadgets",
      sellerName: "Direct Merchant",
      amount: 22.0,
      currency: "USD",
      status: "APPROVED",
      paymentMode: "SIMULATED_SANDBOX",
      paypalOrderId: "ORD-ROGUE-1",
      guardrailResult: {
        dealId: unguardedRunId,
        decision: "AUTO_APPROVED",
        passedAllBlockers: true,
        reason: "Unguarded",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId: "ORD-ROGUE-1", transactionId: tx.id }),
    });

    const res = await captureOrderRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unguarded simulation transactions cannot be captured");
  });

  // TEST 4: Human approval is mandatory for purchases exceeding approvalThreshold ($30)
  it("Test 4: High-value purchase requires explicit human approval; cannot capture prematurely; captures exactly ONCE after approval", async () => {
    const initialBudget = getMandate().remainingBudget;

    // Negotiate item with final price > $30 (e.g. $38)
    const grdReq = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productId: "gadget-3",
        productName: "Noise Cancelling Headphones",
        category: "gadgets",
        listPrice: 42.0,
        minPrice: 38.0,
        mode: "guarded",
        attackMode: false,
      }),
    });

    const grdRes = await negotiateRoute(grdReq);
    const { finalResult } = await readCompleteSSE(grdRes);

    expect(finalResult.status).toBe("needs_approval");
    expect(finalResult.finalPrice).toBeGreaterThan(30.0);
    expect(finalResult.transactionId).toBeDefined();

    // Verify transaction created in PENDING_APPROVAL state
    const transactions = getTransactions();
    const pendingTx = transactions.find((t) => t.id === finalResult.transactionId);
    expect(pendingTx).toBeDefined();
    expect(pendingTx?.status).toBe("PENDING_APPROVAL");

    // Attempting to capture while still PENDING_APPROVAL must be rejected with HTTP 403
    const prematureCaptureReq = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId: "ORD-PREMATURE", transactionId: pendingTx!.id }),
    });
    const prematureCaptureRes = await captureOrderRoute(prematureCaptureReq);
    expect(prematureCaptureRes.status).toBe(403);

    // Attempting create-order without userApproved flag must be rejected with HTTP 403
    const unapprovedOrderReq = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: pendingTx!.id, userApproved: false }),
    });
    const unapprovedOrderRes = await createOrderRoute(unapprovedOrderReq);
    expect(unapprovedOrderRes.status).toBe(403);

    // Now authorize via user approval
    const approvedOrderReq = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: pendingTx!.id, userApproved: true }),
    });
    const approvedOrderRes = await createOrderRoute(approvedOrderReq);
    expect(approvedOrderRes.status).toBe(200);
    const orderData = await approvedOrderRes.json();
    expect(orderData.success).toBe(true);
    expect(orderData.orderId).toBeDefined();

    // Now capture the authorized order
    const captureReq = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId: orderData.orderId, transactionId: pendingTx!.id }),
    });
    const captureRes = await captureOrderRoute(captureReq);
    expect(captureRes.status).toBe(200);
    const captureData = await captureRes.json();
    expect(captureData.success).toBe(true);
    expect(captureData.status).toBe("COMPLETED");

    // Verify EXACTLY one captured transaction in the ledger
    const allTxs = getTransactions();
    const capturedTxs = allTxs.filter((t) => t.status === "PAYPAL_CAPTURED");
    expect(capturedTxs.length).toBe(1);
    expect(capturedTxs[0].id).toBe(pendingTx!.id);

    // Verify budget deducted exactly once
    const expectedBudget = Number((initialBudget - finalResult.finalPrice).toFixed(2));
    expect(getMandate().remainingBudget).toBe(expectedBudget);
  });

  // TEST 5: Rapid double-click on create-order returns the existing order idempotently
  it("Test 5: Rapid double-click on create-order generates identical order ID without duplicating orders", async () => {
    const tx = addTransaction({
      id: "tx-double-click-test",
      dealId: "deal-dc-1",
      productId: "book-dc",
      productName: "Refactoring Catalog",
      category: "books",
      sellerName: "Direct Merchant",
      amount: 25.0,
      currency: "USD",
      status: "APPROVED",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-dc-1",
        decision: "AUTO_APPROVED",
        passedAllBlockers: true,
        reason: "Valid",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Dispatch two concurrent create-order calls
    const req1 = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id }),
    });
    const req2 = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id }),
    });

    const [res1, res2] = await Promise.all([
      createOrderRoute(req1),
      createOrderRoute(req2),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1.orderId).toBeDefined();
    expect(data2.orderId).toBe(data1.orderId);
  });

  // TEST 6: Repeated sequential API requests return the existing order with alreadyCreated: true
  it("Test 6: Repeated sequential requests on create-order return the already created order", async () => {
    const tx = addTransaction({
      id: "tx-sequential-test",
      dealId: "deal-seq-1",
      productId: "book-seq",
      productName: "Architecture Patterns",
      category: "books",
      sellerName: "Direct Merchant",
      amount: 28.0,
      currency: "USD",
      status: "APPROVED",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-seq-1",
        decision: "AUTO_APPROVED",
        passedAllBlockers: true,
        reason: "Valid",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req1 = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id }),
    });
    const res1 = await createOrderRoute(req1);
    const data1 = await res1.json();

    const req2 = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id }),
    });
    const res2 = await createOrderRoute(req2);
    const data2 = await res2.json();

    expect(data2.success).toBe(true);
    expect(data2.orderId).toBe(data1.orderId);
    expect(data2.alreadyCreated).toBe(true);
  });

  // TEST 7: Duplicate capture attempts return alreadyCaptured without double-deducting budget
  it("Test 7: Duplicate capture attempts return alreadyCaptured: true and never double-deduct wallet budget", async () => {
    const initialBudget = getMandate().remainingBudget;
    const amount = 24.0;

    const tx = addTransaction({
      id: "tx-capture-dedup-test",
      dealId: "deal-cap-1",
      productId: "book-cap",
      productName: "Domain Driven Design",
      category: "books",
      sellerName: "Direct Merchant",
      amount,
      currency: "USD",
      status: "APPROVED",
      paypalOrderId: "ORD-DEDUP-CAPTURE-1",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-cap-1",
        decision: "AUTO_APPROVED",
        passedAllBlockers: true,
        reason: "Valid",
        checks: [],
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "DETERMINISTIC_ENGINE",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // First capture
    const req1 = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId: tx.paypalOrderId, transactionId: tx.id }),
    });
    const res1 = await captureOrderRoute(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.status).toBe("COMPLETED");

    const budgetAfterFirstCapture = getMandate().remainingBudget;
    expect(budgetAfterFirstCapture).toBe(Number((initialBudget - amount).toFixed(2)));

    // Second (duplicate) capture attempt
    const req2 = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId: tx.paypalOrderId, transactionId: tx.id }),
    });
    const res2 = await captureOrderRoute(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.success).toBe(true);
    expect(data2.alreadyCaptured).toBe(true);

    // Verify budget was NOT deducted a second time
    const budgetAfterSecondCapture = getMandate().remainingBudget;
    expect(budgetAfterSecondCapture).toBe(budgetAfterFirstCapture);

    // Verify only ONE captured transaction in total
    const capturedTxs = getTransactions().filter((t) => t.status === "PAYPAL_CAPTURED");
    expect(capturedTxs.length).toBe(1);
  });
});
