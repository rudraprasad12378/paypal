import { NextRequest, NextResponse } from "next/server";
import {
  getMandate,
  getTransactions,
  getState,
  updateTransaction,
  addTransaction,
  addAuditLog,
} from "@/lib/store";
import { createPayPalOrder } from "@/lib/paypal";
import { Transaction } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Module-level in-flight order promises to guarantee double-click concurrency protection
const inFlightOrderPromises = new Map<string, Promise<Record<string, unknown>>>();

/**
 * POST /api/paypal/create-order
 *
 * CRITICAL SECURITY & GUARDRAIL REQUIREMENTS:
 * 1. Only allow create-order if the negotiation result status is "approved"
 *    or the user explicitly clicked Approve on a "needs_approval" result.
 * 2. Strictly verify this on the server against the persistent state.
 *    NEVER trust client-reported amounts, status flags, or approval claims.
 * 3. Enforce the Emergency Kill Switch (HTTP 403 if engaged).
 * 4. Verify wallet remaining budget before creating the order.
 * 5. Returns orderId and PayPal approvalUrl for popup or redirect checkout.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { transactionId, dealId, runId, userApproved } = body;

    // Concurrency Deduplication: If an order creation is already in-flight for this transaction/run, await the same promise
    const initialLockKey = transactionId || dealId || runId;
    if (initialLockKey && inFlightOrderPromises.has(initialLockKey)) {
      const cached = await inFlightOrderPromises.get(initialLockKey)!;
      return NextResponse.json({ ...cached, alreadyCreated: true });
    }

    const mandate = getMandate();

    // 1. Enforce Emergency Kill Switch
    if (mandate.killSwitchActive) {
      addAuditLog({
        eventType: "KILL_SWITCH_ENGAGED",
        level: "danger",
        title: "PayPal Order Blocked by Kill Switch",
        details: "Attempted to initiate PayPal order while Emergency Kill Switch is engaged.",
        metadata: { transactionId, dealId, runId },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Emergency Kill Switch is ACTIVE. All payment orders are frozen.",
          killSwitchActive: true,
        },
        { status: 403 }
      );
    }

    const state = getState();
    const transactions = getTransactions();

    // 2. Locate authoritative server record (Transaction or Negotiation Run)
    let targetTx: Transaction | undefined = transactions.find(
      (t) =>
        (transactionId && t.id === transactionId) ||
        (dealId && (t.dealId === dealId || t.id === dealId)) ||
        (runId && (t.dealId === runId || t.id === runId))
    );

    const targetRun = state.negotiationRuns?.find(
      (r) =>
        (runId && r.id === runId) ||
        (dealId && r.id === dealId) ||
        (transactionId && r.id === transactionId)
    );

    // CRITICAL SECURITY ENFORCEMENT: Reject Unguarded Simulation Runs
    if (targetRun && targetRun.mode === "unguarded") {
      return NextResponse.json(
        {
          success: false,
          error: "Security Violation: Unguarded simulation runs cannot create PayPal orders or initiate payments.",
        },
        { status: 403 }
      );
    }

    if (!targetTx && !targetRun) {
      return NextResponse.json(
        {
          success: false,
          error: "Negotiation or transaction record not found on server. Cannot verify eligibility.",
        },
        { status: 404 }
      );
    }

    // 3. Server-Side Verification: Ensure Deal Status is genuinely Approved or Human-Authorized
    if (targetTx) {
      const linkedRun = state.negotiationRuns?.find((r) => r.id === targetTx?.dealId);
      if (linkedRun && linkedRun.mode === "unguarded") {
        return NextResponse.json(
          {
            success: false,
            error: "Security Violation: Unguarded simulation transactions cannot create PayPal orders or initiate payments.",
          },
          { status: 403 }
        );
      }
      if (
        targetTx.status === "REJECTED_GUARDRAIL" ||
        targetTx.status === "REJECTED_HUMAN"
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Security Violation: Transaction #${targetTx.id} was ${targetTx.status}. Payment creation is strictly forbidden.`,
          },
          { status: 403 }
        );
      }

      if (targetTx.status === "PAYPAL_CAPTURED") {
        return NextResponse.json(
          {
            success: false,
            error: `Transaction #${targetTx.id} has already been paid and captured.`,
          },
          { status: 400 }
        );
      }

      // Idempotency: Double-click protection - if this transaction already has an active PayPal order, return it without creating a duplicate
      if (targetTx.paypalOrderId) {
        return NextResponse.json({
          success: true,
          orderId: targetTx.paypalOrderId,
          approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${targetTx.paypalOrderId}`,
          paymentMode: targetTx.paymentMode,
          transactionId: targetTx.id,
          amount: targetTx.amount,
          productName: targetTx.productName,
          alreadyCreated: true,
        });
      }

      if (targetTx.status === "PENDING_APPROVAL") {
        if (!userApproved) {
          return NextResponse.json(
            {
              success: false,
              error: `Transaction #${targetTx.id} requires explicit human approval before PayPal order creation.`,
              needsApproval: true,
            },
            { status: 403 }
          );
        }

        // User explicitly approved the pending transaction
        targetTx =
          updateTransaction(targetTx.id, {
            status: "APPROVED",
          }) || targetTx;

        addAuditLog({
          eventType: "HUMAN_APPROVED",
          level: "success",
          title: `Deal Authorized by User: ${targetTx.productName}`,
          details: `User approved high-value purchase proposal ($${targetTx.amount.toFixed(2)}). Proceeding with PayPal Sandbox order creation.`,
          metadata: { transactionId: targetTx.id, amount: targetTx.amount },
        });
      }
    } else if (targetRun) {
      // Validate run record status
      if (targetRun.status === "blocked") {
        return NextResponse.json(
          {
            success: false,
            error: `Security Violation: Negotiation run was BLOCKED by deterministic guardrails. Reasons: ${targetRun.reasons.join(", ")}`,
          },
          { status: 403 }
        );
      }

      if (targetRun.status === "needs_approval" && !userApproved) {
        return NextResponse.json(
          {
            success: false,
            error: "Negotiation run requires explicit human approval before PayPal order creation.",
            needsApproval: true,
          },
          { status: 403 }
        );
      }

      // Materialize transaction from approved run
      const newTxId = `tx-${Date.now()}`;
      targetTx = addTransaction({
        id: newTxId,
        dealId: targetRun.id,
        productId: targetRun.productId,
        productName: targetRun.productName,
        category: targetRun.category,
        sellerName: "Direct Merchant",
        amount: targetRun.finalPrice,
        currency: "USD",
        status: "APPROVED",
        paymentMode: "SIMULATED_SANDBOX",
        guardrailResult: {
          dealId: targetRun.id,
          decision:
            targetRun.status === "approved"
              ? "AUTO_APPROVED"
              : "NEEDS_HUMAN_APPROVAL",
          passedAllBlockers: true,
          reason: targetRun.reasons.join(" "),
          checks: [],
          evaluatedAt: new Date().toISOString(),
          evaluatedBy: "DETERMINISTIC_ENGINE",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (!targetTx) {
      return NextResponse.json(
        { success: false, error: "Failed to establish verified transaction record." },
        { status: 500 }
      );
    }

    // 4. Verify Wallet Budget on Server (Read strictly from server state)
    const verifiedAmount = targetTx.amount;
    if (mandate.remainingBudget < verifiedAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient remaining wallet budget ($${mandate.remainingBudget.toFixed(2)}) for order amount ($${verifiedAmount.toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    // 5. Construct Experience Return & Cancel URLs
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;

    const returnUrl = `${origin}/paypal/return?txId=${targetTx.id}`;
    const cancelUrl = `${origin}/paypal/cancel?txId=${targetTx.id}`;

    // Concurrency Deduplication: If an order creation is already in-flight for this transaction, await the same promise
    const lockKey = targetTx.id;
    if (inFlightOrderPromises.has(lockKey)) {
      const cached = await inFlightOrderPromises.get(lockKey)!;
      return NextResponse.json({ ...cached, alreadyCreated: true });
    }

    const orderExecution = (async () => {
      // 6. Create PayPal Sandbox Order (POST /v2/checkout/orders)
      const orderResult = await createPayPalOrder({
        amount: verifiedAmount,
        currency: targetTx.currency || "USD",
        description: `${targetTx.productName} via Mandate AI Wallet`,
        customId: targetTx.id,
        productName: targetTx.productName,
        returnUrl,
        cancelUrl,
      });

      // 7. Update transaction with PayPal order id & status
      updateTransaction(targetTx.id, {
        paypalOrderId: orderResult.orderId,
        status: "PAYMENT_PROCESSING",
        paymentMode: orderResult.paymentMode,
      });

      // 8. Log PayPal order creation in audit log
      addAuditLog({
        eventType: "PAYPAL_ORDER_CREATED",
        level: "info",
        title: `PayPal Order Created (${orderResult.paymentMode})`,
        details: `PayPal Sandbox Order #${orderResult.orderId} created for '${targetTx.productName}' ($${verifiedAmount.toFixed(2)}). Awaiting approval.`,
        metadata: {
          orderId: orderResult.orderId,
          transactionId: targetTx.id,
          amount: verifiedAmount,
          approvalUrl: orderResult.approvalUrl,
          paymentMode: orderResult.paymentMode,
        },
      });

      return {
        success: true,
        orderId: orderResult.orderId,
        approvalUrl: orderResult.approvalUrl,
        paymentMode: orderResult.paymentMode,
        transactionId: targetTx.id,
        amount: verifiedAmount,
        productName: targetTx.productName,
      };
    })();

    inFlightOrderPromises.set(lockKey, orderExecution);
    if (initialLockKey) inFlightOrderPromises.set(initialLockKey, orderExecution);
    try {
      const resultData = await orderExecution;
      return NextResponse.json(resultData);
    } finally {
      inFlightOrderPromises.delete(lockKey);
      if (initialLockKey) inFlightOrderPromises.delete(initialLockKey);
    }
  } catch (err: unknown) {
    console.error("PayPal create-order error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while creating PayPal order.",
      },
      { status: 500 }
    );
  }
}

