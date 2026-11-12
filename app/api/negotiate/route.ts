import { NextRequest, NextResponse } from "next/server";
import {
  getMandate,
  getProductById,
  addTransaction,
  addAuditLog,
  deductBudget,
  updateTransaction,
} from "@/lib/store";
import { runAgentNegotiation } from "@/lib/negotiator";
import { evaluateDealGuardrails } from "@/lib/guardrails";
import { createPayPalOrder, capturePayPalOrder } from "@/lib/paypal";
import { CatalogProduct, Transaction } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mandate = getMandate();

    // 1. FAST FAIL: KILL SWITCH CHECK
    if (mandate.killSwitchActive) {
      addAuditLog({
        eventType: "KILL_SWITCH_ENGAGED",
        level: "danger",
        title: "Negotiation Blocked by Kill Switch",
        details: "Attempted to initiate AI agent negotiation while emergency kill switch was active.",
      });

      return NextResponse.json(
        {
          success: false,
          error: "KILL_SWITCH_ACTIVE",
          message: "Emergency kill switch is active. AI agents and transactions are halted.",
        },
        { status: 403 }
      );
    }

    // 2. RESOLVE PRODUCT
    let product: CatalogProduct | undefined;
    if (body.productId) {
      product = getProductById(body.productId);
    } else if (body.customProduct) {
      product = {
        id: `custom-${Date.now()}`,
        name: body.customProduct.name || "Custom Item",
        category: body.customProduct.category || "Electronics",
        listPrice: Number(body.customProduct.listPrice) || 30.0,
        minReservePrice: Number(body.customProduct.minReservePrice) || Number(body.customProduct.listPrice) * 0.75,
        description: body.customProduct.description || "Custom user requested item",
        sellerName: body.customProduct.sellerName || "Global Merchant Inc.",
        sellerStyle: "fair",
        imageEmoji: "📦",
      };
    }

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found or invalid" },
        { status: 400 }
      );
    }

    addAuditLog({
      eventType: "NEGOTIATION_STARTED",
      level: "info",
      title: `Agent Negotiation Started: ${product.name}`,
      details: `Buyer AI initiated procurement for '${product.name}' (List: $${product.listPrice.toFixed(2)}) with seller '${product.sellerName}'.`,
      metadata: { productId: product.id, listPrice: product.listPrice },
    });

    // 3. EXECUTE AGENT NEGOTIATION
    const buyerIntent =
      body.userGoal || `Acquire ${product.name} under mandate rules`;
    const deal = await runAgentNegotiation({
      product,
      mandate,
      buyerIntent,
      maxTurns: 4,
    });

    addAuditLog({
      eventType: "NEGOTIATION_CONCLUDED",
      level: "info",
      title: `Negotiation Concluded: $${deal.agreedPrice.toFixed(2)}`,
      details: `Agents agreed on $${deal.agreedPrice.toFixed(2)} (Savings: $${deal.savings.toFixed(2)}) after ${deal.turns.length} turns. Routing to Deterministic Guardrails.`,
      metadata: { dealId: deal.id, agreedPrice: deal.agreedPrice },
    });

    // 4. DETERMINISTIC GUARDRAIL ENGINE (Code, NOT LLM)
    const guardrailResult = evaluateDealGuardrails(deal, mandate);

    addAuditLog({
      eventType: "GUARDRAILS_EVALUATED",
      level:
        guardrailResult.decision === "AUTO_APPROVED"
          ? "success"
          : guardrailResult.decision === "NEEDS_HUMAN_APPROVAL"
          ? "warning"
          : "danger",
      title: `Guardrail Evaluation: ${guardrailResult.decision}`,
      details: guardrailResult.reason,
      metadata: { checks: guardrailResult.checks },
    });

    // 5. TRANSACTION ROUTING BASED ON DETERMINISTIC DECISION
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let initialTxStatus: Transaction["status"] = "PENDING_APPROVAL";
    let paymentMode: Transaction["paymentMode"] = "SIMULATED_SANDBOX";

    if (guardrailResult.decision === "REJECTED") {
      initialTxStatus = "REJECTED_GUARDRAIL";
    } else if (guardrailResult.decision === "AUTO_APPROVED") {
      initialTxStatus = "PAYMENT_PROCESSING";
    } else {
      initialTxStatus = "PENDING_APPROVAL";
    }

    let transaction: Transaction = {
      id: txId,
      dealId: deal.id,
      productId: product.id,
      productName: product.name,
      category: String(product.category),
      sellerName: product.sellerName,
      amount: deal.agreedPrice,
      currency: "USD",
      status: initialTxStatus,
      guardrailResult,
      paymentMode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addTransaction(transaction);

    // 6. IF AUTO-APPROVED, EXECUTE PAYPAL SANDBOX CHECKOUT IMMEDIATELY
    if (guardrailResult.decision === "AUTO_APPROVED") {
      try {
        // Create PayPal Order
        const orderResult = await createPayPalOrder({
          amount: deal.agreedPrice,
          currency: "USD",
          description: `${product.name} - Mandate AI Auto-Authorized`,
          customId: txId,
          productName: product.name,
        });

        paymentMode = orderResult.paymentMode;

        addAuditLog({
          eventType: "PAYPAL_ORDER_CREATED",
          level: "info",
          title: `PayPal Order Created (${orderResult.paymentMode})`,
          details: `PayPal Orders API v2 order #${orderResult.orderId} created for $${deal.agreedPrice.toFixed(2)}.`,
          metadata: { orderId: orderResult.orderId },
        });

        // Capture PayPal Order
        const captureResult = await capturePayPalOrder(orderResult.orderId);

        if (captureResult.status === "COMPLETED") {
          deductBudget(deal.agreedPrice);

          const updatedTx = updateTransaction(txId, {
            status: "PAYPAL_CAPTURED",
            paypalOrderId: orderResult.orderId,
            paypalCaptureId: captureResult.captureId,
            paymentMode: orderResult.paymentMode,
          });

          if (updatedTx) transaction = updatedTx;

          addAuditLog({
            eventType: "PAYPAL_PAYMENT_CAPTURED",
            level: "success",
            title: `Payment Captured via PayPal Sandbox`,
            details: `Successfully captured $${deal.agreedPrice.toFixed(2)}. Capture ID: ${captureResult.captureId}. Remaining budget: $${getMandate().remainingBudget.toFixed(2)}.`,
            metadata: {
              orderId: orderResult.orderId,
              captureId: captureResult.captureId,
            },
          });
        } else {
          const updatedTx = updateTransaction(txId, {
            status: "PAYMENT_FAILED",
            paypalOrderId: orderResult.orderId,
          });
          if (updatedTx) transaction = updatedTx;

          addAuditLog({
            eventType: "PAYPAL_PAYMENT_FAILED",
            level: "danger",
            title: `PayPal Capture Failed`,
            details: `Order #${orderResult.orderId} could not be captured.`,
          });
        }
      } catch (payErr: unknown) {
        console.error("PayPal processing error:", payErr);
        const updatedTx = updateTransaction(txId, {
          status: "PAYMENT_FAILED",
        });
        if (updatedTx) transaction = updatedTx;
      }
    }

    return NextResponse.json({
      success: true,
      deal,
      guardrailResult,
      transaction,
      mandate: getMandate(),
    });
  } catch (err: unknown) {
    console.error("Negotiate API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to process negotiation",
      },
      { status: 500 }
    );
  }
}
