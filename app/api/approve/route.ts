import { NextRequest, NextResponse } from "next/server";
import {
  getMandate,
  getTransactions,
  updateTransaction,
  addAuditLog,
  deductBudget,
} from "@/lib/store";
import { createPayPalOrder, capturePayPalOrder } from "@/lib/paypal";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId, decision } = body; // decision: "APPROVE" | "REJECT"

    if (!transactionId || !decision) {
      return NextResponse.json(
        { success: false, error: "Missing transactionId or decision" },
        { status: 400 }
      );
    }

    const transactions = getTransactions();
    const tx = transactions.find((t) => t.id === transactionId);

    if (!tx) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (tx.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        {
          success: false,
          error: `Transaction is already in '${tx.status}' state and cannot be modified.`,
        },
        { status: 400 }
      );
    }

    // HUMAN REJECTION
    if (decision === "REJECT") {
      const updated = updateTransaction(transactionId, {
        status: "REJECTED_HUMAN",
      });

      addAuditLog({
        eventType: "HUMAN_REJECTED",
        level: "warning",
        title: `Deal Vetoed by User`,
        details: `User explicitly rejected purchase proposal for '${tx.productName}' ($${tx.amount.toFixed(2)}).`,
        metadata: { transactionId },
      });

      return NextResponse.json({
        success: true,
        transaction: updated,
        mandate: getMandate(),
      });
    }

    // HUMAN APPROVAL -> TRIGGER PAYPAL CHECKOUT
    if (decision === "APPROVE") {
      const mandate = getMandate();

      // Check kill switch
      if (mandate.killSwitchActive) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot approve: Emergency Kill Switch is currently active.",
          },
          { status: 403 }
        );
      }

      // Check remaining budget
      if (mandate.remainingBudget < tx.amount) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient budget ($${mandate.remainingBudget.toFixed(2)}) for transaction ($${tx.amount.toFixed(2)}).`,
          },
          { status: 400 }
        );
      }

      addAuditLog({
        eventType: "HUMAN_APPROVED",
        level: "success",
        title: `Deal Authorized by User`,
        details: `User approved high-value purchase of '${tx.productName}' ($${tx.amount.toFixed(2)}). Initiating PayPal Sandbox execution.`,
        metadata: { transactionId, amount: tx.amount },
      });

      // Update to processing
      updateTransaction(transactionId, { status: "PAYMENT_PROCESSING" });

      // Create PayPal order
      const orderResult = await createPayPalOrder({
        amount: tx.amount,
        currency: tx.currency,
        description: `${tx.productName} - User Authorized`,
        customId: tx.id,
        productName: tx.productName,
      });

      addAuditLog({
        eventType: "PAYPAL_ORDER_CREATED",
        level: "info",
        title: `PayPal Order Created (${orderResult.paymentMode})`,
        details: `Order #${orderResult.orderId} created for authorized transaction.`,
        metadata: { orderId: orderResult.orderId },
      });

      // Capture order
      const captureResult = await capturePayPalOrder(orderResult.orderId);

      if (captureResult.status === "COMPLETED") {
        deductBudget(tx.amount);

        const updatedTx = updateTransaction(transactionId, {
          status: "PAYPAL_CAPTURED",
          paypalOrderId: orderResult.orderId,
          paypalCaptureId: captureResult.captureId,
          paymentMode: orderResult.paymentMode,
        });

        addAuditLog({
          eventType: "PAYPAL_PAYMENT_CAPTURED",
          level: "success",
          title: `Payment Captured via PayPal Sandbox`,
          details: `Captured $${tx.amount.toFixed(2)}. Capture ID: ${captureResult.captureId}. Remaining budget: $${getMandate().remainingBudget.toFixed(2)}.`,
          metadata: {
            orderId: orderResult.orderId,
            captureId: captureResult.captureId,
          },
        });

        return NextResponse.json({
          success: true,
          transaction: updatedTx,
          mandate: getMandate(),
        });
      } else {
        const failedTx = updateTransaction(transactionId, {
          status: "PAYMENT_FAILED",
          paypalOrderId: orderResult.orderId,
        });

        addAuditLog({
          eventType: "PAYPAL_PAYMENT_FAILED",
          level: "danger",
          title: `PayPal Capture Failed`,
          details: `Capture failed for order #${orderResult.orderId}.`,
        });

        return NextResponse.json({
          success: false,
          error: "PayPal capture failed",
          transaction: failedTx,
        });
      }
    }

    return NextResponse.json(
      { success: false, error: "Invalid decision value" },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("Approve API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Approval processing error",
      },
      { status: 500 }
    );
  }
}
