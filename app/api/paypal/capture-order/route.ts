import { NextRequest, NextResponse } from "next/server";
import {
  getMandate,
  getTransactions,
  updateTransaction,
  addAuditLog,
  deductBudget,
} from "@/lib/store";
import { capturePayPalOrder } from "@/lib/paypal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // 2. Find Transaction
    const transactions = getTransactions();
    let tx = transactions.find(
      (t) =>
        t.paypalOrderId === orderId ||
        (transactionId && t.id === transactionId)
    );

    // Idempotency: If already captured, return success immediately
    if (tx && tx.status === "PAYPAL_CAPTURED") {
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        alreadyCaptured: true,
        orderId,
        captureId: tx.paypalCaptureId,
        transaction: tx,
        paymentMode: tx.paymentMode,
      });
    }

    // 3. Issue PayPal Capture Request (POST /v2/checkout/orders/{id}/capture)
    const captureResult = await capturePayPalOrder(orderId);

    if (captureResult.status === "COMPLETED") {
      const captureId = captureResult.captureId || `CAP-${Date.now()}`;
      const amountToDeduct = tx ? tx.amount : 0;

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

      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        orderId,
        captureId,
        transaction: updatedTx,
        paymentMode: captureResult.paymentMode,
        remainingBudget: refreshedMandate.remainingBudget,
      });
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

      return NextResponse.json(
        {
          success: false,
          status: "FAILED",
          error: captureResult.error || "PayPal payment capture failed.",
          orderId,
        },
        { status: 400 }
      );
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
