import { NextRequest, NextResponse } from "next/server";
import {
  getMandate,
  getTransactions,
  getState,
  updateTransaction,
  addAuditLog,
  deductBudget,
} from "@/lib/store";
import { capturePayPalOrder } from "@/lib/paypal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Module-level in-flight capture promises for double-click / concurrent capture protection
const inFlightCapturePromises = new Map<
  string,
  Promise<{ status: number; body: Record<string, unknown> }>
>();

/**
 * POST /api/paypal/capture-order
 *
 * CRITICAL EXECUTION REQUIREMENTS:
 * 1. Captures authorized PayPal order via Orders API v2:
 *    POST /v2/checkout/orders/{id}/capture
 * 2. Enforces Emergency Kill Switch before capturing funds.
 * 3. Idempotently verifies transaction status.
 * 4. Deducts captured amount from the wallet budget.
 * 5. Updates transaction status to PAYPAL_CAPTURED with captureId.
 * 6. Appends audit log entry for total financial transparency.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, transactionId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing required PayPal orderId parameter." },
        { status: 400 }
      );
    }

    const mandate = getMandate();

    // 1. Enforce Emergency Kill Switch
    if (mandate.killSwitchActive) {
      addAuditLog({
        eventType: "KILL_SWITCH_ENGAGED",
        level: "danger",
        title: "PayPal Capture Blocked by Kill Switch",
        details: `Capture attempt for Order #${orderId} aborted because Emergency Kill Switch is engaged.`,
        metadata: { orderId, transactionId },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Emergency Kill Switch is ACTIVE. Payment capture halted.",
          killSwitchActive: true,
        },
        { status: 403 }
      );
    }

    // Double-click concurrency deduplication
    const lockKey = orderId || transactionId;
    if (inFlightCapturePromises.has(lockKey)) {
      const concurrentResult = await inFlightCapturePromises.get(lockKey)!;
      return NextResponse.json(
        { ...concurrentResult.body, alreadyCaptured: true },
        { status: concurrentResult.status }
      );
    }

    const captureExecution = (async () => {
      // 2. Find Transaction
      const transactions = getTransactions();
      const tx = transactions.find(
        (t) =>
          t.paypalOrderId === orderId ||
          (transactionId && t.id === transactionId)
      );

      // Verify transaction exists
      if (!tx) {
        return {
          status: 404,
          body: {
            success: false,
            error: `Transaction record not found for order #${orderId}. Cannot capture untracked order.`,
          },
        };
      }

      // CRITICAL SECURITY ENFORCEMENT: Reject Unguarded Simulation Transactions
      const state = getState();
      const linkedRun = state.negotiationRuns?.find((r) => r.id === tx.dealId);
      if (linkedRun && linkedRun.mode === "unguarded") {
        return {
          status: 403,
          body: {
            success: false,
            error: "Security Violation: Unguarded simulation transactions cannot be captured.",
          },
        };
      }

      // Check if human approval is pending or transaction was rejected
      if (tx.status === "PENDING_APPROVAL") {
        return {
          status: 403,
          body: {
            success: false,
            error: `Security Violation: Transaction #${tx.id} requires explicit human approval before payment can be captured.`,
            needsApproval: true,
          },
        };
      }

      if (tx.status === "REJECTED_GUARDRAIL" || tx.status === "REJECTED_HUMAN") {
        return {
          status: 403,
          body: {
            success: false,
            error: `Security Violation: Transaction #${tx.id} was rejected (${tx.status}). Payment capture is forbidden.`,
          },
        };
      }

      // Idempotency: If already captured, return success immediately without re-capturing or re-deducting budget
      if (tx.status === "PAYPAL_CAPTURED") {
        return {
          status: 200,
          body: {
            success: true,
            status: "COMPLETED",
            alreadyCaptured: true,
            orderId,
            captureId: tx.paypalCaptureId,
            transaction: tx,
            paymentMode: tx.paymentMode,
          },
        };
      }

      // 3. Issue PayPal Capture Request (POST /v2/checkout/orders/{id}/capture)
      const captureResult = await capturePayPalOrder(orderId);

      if (captureResult.status === "COMPLETED") {
        const captureId = captureResult.captureId || `CAP-${Date.now()}`;
        const amountToDeduct = tx.amount;

        // 4. Deduct budget in store
        if (amountToDeduct > 0) {
          deductBudget(amountToDeduct);
        }

        // 5. Update transaction record
        let updatedTx = tx;
        if (tx) {
          updatedTx =
            updateTransaction(tx.id, {
              status: "PAYPAL_CAPTURED",
              paypalOrderId: orderId,
              paypalCaptureId: captureId,
              paymentMode: captureResult.paymentMode,
            }) || tx;
        }

        const refreshedMandate = getMandate();

        // 6. Record Audit Log Entry
        addAuditLog({
          eventType: "PAYPAL_PAYMENT_CAPTURED",
          level: "success",
          title: `Payment Captured via PayPal Sandbox (${captureResult.paymentMode})`,
          details: `Successfully captured $${amountToDeduct.toFixed(2)} for '${tx ? tx.productName : "PayPal Order"}'. PayPal Capture ID: ${captureId}. Order ID: ${orderId}. Remaining budget: $${refreshedMandate.remainingBudget.toFixed(2)}.`,
          metadata: {
            orderId,
            captureId,
            amount: amountToDeduct,
            paymentMode: captureResult.paymentMode,
            transactionId: tx?.id,
            remainingBudget: refreshedMandate.remainingBudget,
          },
        });

        return {
          status: 200,
          body: {
            success: true,
            status: "COMPLETED",
            orderId,
            captureId,
            transaction: updatedTx,
            paymentMode: captureResult.paymentMode,
            remainingBudget: refreshedMandate.remainingBudget,
          },
        };
      } else {
        // Capture failure handling
        if (tx) {
          updateTransaction(tx.id, {
            status: "PAYMENT_FAILED",
            paypalOrderId: orderId,
          });
        }

        addAuditLog({
          eventType: "PAYPAL_PAYMENT_FAILED",
          level: "danger",
          title: "PayPal Capture Failed",
          details: `Capture was not completed for PayPal order #${orderId}. Reason: ${captureResult.error || "Payment not approved or voided"}`,
          metadata: { orderId, error: captureResult.error },
        });

        return {
          status: 400,
          body: {
            success: false,
            status: "FAILED",
            error: captureResult.error || "PayPal payment capture failed.",
            orderId,
          },
        };
      }
    })();

    inFlightCapturePromises.set(lockKey, captureExecution);
    try {
      const outcome = await captureExecution;
      return NextResponse.json(outcome.body, { status: outcome.status });
    } finally {
      inFlightCapturePromises.delete(lockKey);
    }
  } catch (err: unknown) {
    console.error("PayPal capture-order error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while capturing PayPal order.",
      },
      { status: 500 }
    );
  }
}

