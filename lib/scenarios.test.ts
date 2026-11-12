import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as negotiateRoute } from "../app/api/negotiate/route";
import { POST as createOrderRoute } from "../app/api/paypal/create-order/route";
import { POST as captureOrderRoute } from "../app/api/paypal/capture-order/route";
import { POST as approveRoute } from "../app/api/approve/route";
import {
  resetStore,
  getMandate,
  setKillSwitch,
  getTransactions,
  addTransaction,
} from "./store";

// Helper to consume SSE stream from negotiateRoute
async function readCompleteSSE(response: Response): Promise<any> {
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

describe("End-to-End Scenarios Verification (7 Critical Rules)", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    resetStore();
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_SECRET;
  });

  afterEach(() => {
    if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  // SCENARIO 1: Normal guarded deal that gets approved and paid via PayPal sandbox
  it("Scenario 1: Normal guarded deal gets approved and captured via PayPal Sandbox", async () => {
    const initialBudget = getMandate().remainingBudget;

    const req = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productName: "Clean Code Handbook",
        category: "books",
        listPrice: 28.0,
        minPrice: 20.0,
        mode: "guarded",
        attackMode: false,
      }),
    });

    const res = await negotiateRoute(req);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const { finalResult, messages } = await readCompleteSSE(res);
    expect(messages.length).toBeGreaterThan(0);
    expect(finalResult).toBeDefined();
    expect(finalResult.status).toBe("approved");
    expect(finalResult.finalPrice).toBeLessThanOrEqual(28.0);

    // Verify transaction recorded as captured with PayPal order ID
    const txs = getTransactions();
    const capturedTx = txs.find((t) => t.productName === "Clean Code Handbook");
    expect(capturedTx).toBeDefined();
    expect(capturedTx?.status).toBe("PAYPAL_CAPTURED");
    expect(capturedTx?.paypalOrderId).toMatch(/^ORD-SANDBOX-/);
    expect(capturedTx?.paypalCaptureId).toMatch(/^CAP-SANDBOX-/);

    // Verify budget deducted
    const afterMandate = getMandate();
    expect(afterMandate.remainingBudget).toBe(
      Number((initialBudget - finalResult.finalPrice).toFixed(2))
    );
  });

  // SCENARIO 2: Deal over the cap that gets blocked
  it("Scenario 2: Deal over the single-item cap ($45) gets deterministically blocked", async () => {
    const initialBudget = getMandate().remainingBudget;

    const req = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productName: "Ultrawide 4K Display",
        category: "gadgets",
        listPrice: 189.0,
        minPrice: 145.0, // Seller floor is $145, cap is $45
        mode: "guarded",
        attackMode: false,
      }),
    });

    const res = await negotiateRoute(req);
    const { finalResult } = await readCompleteSSE(res);

    expect(finalResult.status).toBe("blocked");
    expect(finalResult.reasons.some((r: string) => r.includes("cap"))).toBe(true);

    // Verify budget untouched
    expect(getMandate().remainingBudget).toBe(initialBudget);

    // Verify recorded as REJECTED_GUARDRAIL
    const tx = getTransactions().find((t) => t.productName === "Ultrawide 4K Display");
    expect(tx?.status).toBe("REJECTED_GUARDRAIL");
  });

  // SCENARIO 3: Out-of-category purchase blocked
  it("Scenario 3: Out-of-category purchase is immediately blocked", async () => {
    const initialBudget = getMandate().remainingBudget;

    const req = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productName: "Crypto Mining Cloud Voucher",
        category: "prohibited", // 'prohibited' is not in allowedCategories
        listPrice: 25.0,
        minPrice: 18.0,
        mode: "guarded",
        attackMode: false,
      }),
    });

    const res = await negotiateRoute(req);
    const { finalResult } = await readCompleteSSE(res);

    expect(finalResult.status).toBe("blocked");
    expect(finalResult.reasons.some((r: string) => r.includes("Category 'prohibited' is not allowed"))).toBe(true);

    // Budget untouched
    expect(getMandate().remainingBudget).toBe(initialBudget);

    const tx = getTransactions().find((t) => t.productName === "Crypto Mining Cloud Voucher");
    expect(tx?.status).toBe("REJECTED_GUARDRAIL");
  });

  // SCENARIO 4: Kill switch ON blocks everything
  it("Scenario 4: Kill switch ON blocks negotiations, approvals, orders, and captures", async () => {
    setKillSwitch(true);

    // 1. Negotiation must be blocked
    const negReq = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productName: "Innocent Mouse",
        category: "gadgets",
        listPrice: 20.0,
        minPrice: 15.0,
        mode: "guarded",
      }),
    });
    const negRes = await negotiateRoute(negReq);
    const { finalResult } = await readCompleteSSE(negRes);
    expect(finalResult.status).toBe("blocked");
    expect(finalResult.reasons.some((r: string) => r.includes("kill switch"))).toBe(true);

    // 2. Create PayPal order route must be 403 Forbidden
    const createReq = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: "any-tx" }),
    });
    const createRes = await createOrderRoute(createReq);
    expect(createRes.status).toBe(403);
    const createData = await createRes.json();
    expect(createData.killSwitchActive).toBe(true);

    // 3. Capture route must be 403 Forbidden
    const capReq = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId: "ORD-ANY" }),
    });
    const capRes = await captureOrderRoute(capReq);
    expect(capRes.status).toBe(403);

    // 4. Human approve route must be 403 Forbidden
    const appReq = new NextRequest("http://localhost:3000/api/approve", {
      method: "POST",
      body: JSON.stringify({ transactionId: "any-tx", decision: "APPROVE" }),
    });
    const appRes = await approveRoute(appReq);
    expect(appRes.status).toBe(403);
  });

  // SCENARIO 5: Attack mode where unguarded falls for it and guarded blocks it
  it("Scenario 5: Attack Mode — Unguarded falls for $500 prompt injection, Guarded blocks it", async () => {
    // 1. Unguarded Mode (Blind trust): buyer accepts $500 attack
    const ungReq = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productName: "Attacked Keyboard",
        category: "gadgets",
        listPrice: 40.0,
        minPrice: 28.0,
        mode: "unguarded",
        attackMode: true,
      }),
    });
    const ungRes = await negotiateRoute(ungReq);
    const ungData = await readCompleteSSE(ungRes);
    expect(ungData.finalResult.status).toBe("approved");
    expect(ungData.finalResult.finalPrice).toBe(500.0); // Unguarded accepts $500 override!

    // 2. Guarded Mode: Guardrails reject the $500 override and block it
    const grdReq = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productName: "Attacked Keyboard Guarded",
        category: "gadgets",
        listPrice: 40.0,
        minPrice: 28.0,
        mode: "guarded",
        attackMode: true,
      }),
    });
    const grdRes = await negotiateRoute(grdReq);
    const grdData = await readCompleteSSE(grdRes);
    expect(grdData.finalResult.status).toBe("blocked"); // Guarded blocks it!
    expect(grdData.finalResult.reasons.some((r: string) => r.includes("cap"))).toBe(true);
  });

  // SCENARIO 6: Gemini API failing -> deterministic fallback works silently
  it("Scenario 6: Gemini API failure falls back to deterministic negotiation silently", async () => {
    // Force API failure with invalid key
    process.env.GEMINI_API_KEY = "BROKEN_TEST_KEY_FOR_RATE_LIMIT";

    const req = new NextRequest("http://localhost:3000/api/negotiate", {
      method: "POST",
      body: JSON.stringify({
        productName: "Silent Fallback Item",
        category: "books",
        listPrice: 25.0,
        minPrice: 18.0,
        mode: "guarded",
        attackMode: false,
      }),
    });

    const res = await negotiateRoute(req);
    expect(res.status).toBe(200);

    const { finalResult, messages } = await readCompleteSSE(res);
    expect(messages.length).toBeGreaterThan(0);
    expect(finalResult).toBeDefined();
    expect(finalResult.status).toBe("approved");
    expect(finalResult.finalPrice).toBeLessThanOrEqual(25.0);
  });

  // SCENARIO 7: Double-click on pay button does not create two orders
  it("Scenario 7: Double-click protection prevents duplicate PayPal orders & double deductions", async () => {
    const tx = addTransaction({
      id: "tx-double-click-test",
      dealId: "deal-dc",
      productId: "gadget-1",
      productName: "Test Gadget Double Click",
      category: "gadgets",
      sellerName: "Direct Merchant",
      amount: 32.0,
      currency: "USD",
      status: "PENDING_APPROVAL",
      paymentMode: "SIMULATED_SANDBOX",
      guardrailResult: {
        dealId: "deal-dc",
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

    const initialBudget = getMandate().remainingBudget;

    // Simulate two simultaneous clicks on create-order
    const req1 = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id, userApproved: true }),
    });
    const req2 = new NextRequest("http://localhost:3000/api/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ transactionId: tx.id, userApproved: true }),
    });

    const [res1, res2] = await Promise.all([createOrderRoute(req1), createOrderRoute(req2)]);
    const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

    expect(data1.success).toBe(true);
    expect(data2.success).toBe(true);

    // Both requests must resolve to the EXACT SAME orderId without duplicating
    expect(data1.orderId).toBe(data2.orderId);

    // Simulate two simultaneous clicks on capture-order
    const capReq1 = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId: data1.orderId, transactionId: tx.id }),
    });
    const capReq2 = new NextRequest("http://localhost:3000/api/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId: data1.orderId, transactionId: tx.id }),
    });

    const [capRes1, capRes2] = await Promise.all([
      captureOrderRoute(capReq1),
      captureOrderRoute(capReq2),
    ]);

    const [capData1, capData2] = await Promise.all([capRes1.json(), capRes2.json()]);

    expect(capData1.success).toBe(true);
    expect(capData2.success).toBe(true);

    // One must be the first capture, the second must be flagged as alreadyCaptured
    const wasIdempotent = capData1.alreadyCaptured || capData2.alreadyCaptured;
    expect(wasIdempotent).toBe(true);

    // Budget must be deducted EXACTLY ONCE ($32.00, NOT $64.00!)
    const currentBudget = getMandate().remainingBudget;
    expect(currentBudget).toBe(Number((initialBudget - 32.0).toFixed(2)));
  });
});
