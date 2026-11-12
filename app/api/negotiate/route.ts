import { NextRequest } from "next/server";
import { evaluate, Mandate as GuardrailMandate, Proposal } from "@/lib/guardrails";
import {
  BuyerAgent,
  SellerAgent,
  parseProtocolMessage,
  enforceBuyerBounds,
  enforceSellerBounds,
  deterministicBuyerTurn,
  deterministicSellerTurn,
} from "@/lib/agents";
import {
  getState,
  getMandate,
  logNegotiationRun,
  addTransaction,
  deductBudget,
} from "@/lib/store";
import { INITIAL_CATALOG } from "@/lib/catalog";
import { createPayPalOrder, capturePayPalOrder } from "@/lib/paypal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TurnMessage {
  round: number;
  speaker: "buyer" | "seller";
  message: string;
  rawMessage: string;
  price: number;
  isDeal: boolean;
  coached?: boolean;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const currentStoreMandate = getMandate();
  const state = getState();

  // 1. Resolve Mandate Input
  const mandate: GuardrailMandate = {
    dailyBudget: Number(body.mandate?.dailyBudget ?? currentStoreMandate.totalBudget),
    perPurchaseCap: Number(body.mandate?.perPurchaseCap ?? currentStoreMandate.maxItemPrice),
    allowedCategories: Array.isArray(body.mandate?.allowedCategories)
      ? body.mandate.allowedCategories
      : currentStoreMandate.allowedCategories,
    approvalThreshold: Number(body.mandate?.approvalThreshold ?? currentStoreMandate.approvalThreshold),
    killSwitch: Boolean(body.mandate?.killSwitch ?? currentStoreMandate.killSwitchActive),
  };

  const spentToday = Number(body.mandate?.spentToday ?? currentStoreMandate.spentAmount);

  // 2. Resolve Product
  const productId = body.productId || "gadget-1";
  const product =
    state.products.find((p) => p.id === productId) ||
    INITIAL_CATALOG.find((p) => p.id === productId) || {
      id: productId,
      name: body.productName || "Selected Item",
      category: body.category || "gadgets",
      listPrice: Number(body.listPrice) || 40.0,
      minPrice: Number(body.minPrice) || 28.0,
      minReservePrice: Number(body.minPrice) || 28.0,
      description: "Negotiated product",
      sellerName: "Direct Merchant",
      sellerStyle: "fair",
      imageEmoji: "📦",
    };

  const listPrice = product.listPrice;
  const minPrice = product.minPrice || product.minReservePrice || listPrice * 0.7;
  const userRequest = body.userRequest || `Purchase ${product.name} at best available price`;
  const mode: "guarded" | "unguarded" = body.mode === "unguarded" ? "unguarded" : "guarded";
  const attackMode: boolean = Boolean(body.attackMode);

  // Buyer's private max price (derived from cap & budget)
  const buyerPrivateMax = Math.min(
    mandate.perPurchaseCap,
    Math.max(10, mandate.dailyBudget - spentToday)
  );

  // Set up streaming response (Server-Sent Events)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendEvent({
          type: "init",
          mode,
          attackMode,
          product: {
            id: product.id,
            name: product.name,
            category: product.category,
            listPrice,
          },
          mandate,
        });

        const turns: TurnMessage[] = [];
        let isDealReached = false;
        let lastDealPrice = listPrice;
        let lastSellerOffer = listPrice;
        let lastBuyerOffer = Math.min(buyerPrivateMax, listPrice * 0.72);

        const buyer = new BuyerAgent({
          userRequest,
          privateMaxPrice: buyerPrivateMax,
        });

        const seller = new SellerAgent({
          productName: product.name,
          listPrice: attackMode ? listPrice * 1.8 : listPrice,
          privateMinPrice: minPrice,
          attackMode,
        });

        const hasGeminiKey = Boolean(
          process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ""
        );

        // Run max 5 negotiation rounds
        for (let round = 1; round <= 5; round++) {
          // --- BUYER TURN ---
          let buyerMsg = "";
          let buyerPrice = lastBuyerOffer;
          let buyerIsDeal = false;

          if (hasGeminiKey) {
            try {
              const history = turns.map((t) => ({
                speaker: t.speaker,
                message: t.rawMessage,
                price: t.price,
              }));
              const result = await buyer.generateResponse(history, listPrice);
              buyerMsg = result.message;
              buyerPrice = result.price;
              buyerIsDeal = result.isDeal;
            } catch (err) {
              console.warn("Buyer LLM call failed, using deterministic fallback:", err);
              const fb = deterministicBuyerTurn(round, buyerPrivateMax, listPrice, lastSellerOffer, mode === "unguarded", attackMode);
              buyerMsg = fb.message;
              buyerPrice = fb.price;
              buyerIsDeal = fb.isDeal;
            }
          } else {
            const fb = deterministicBuyerTurn(round, buyerPrivateMax, listPrice, lastSellerOffer, mode === "unguarded", attackMode);
            buyerMsg = fb.message;
            buyerPrice = fb.price;
            buyerIsDeal = fb.isDeal;
          }

          // In guarded mode, enforce buyer bounds in code
          const parsedBuyer = parseProtocolMessage(buyerMsg, "buyer");
          const enforcedBuyer = mode === "guarded"
            ? enforceBuyerBounds(parsedBuyer.price ?? buyerPrice, buyerPrivateMax, buyerPrice)
            : { finalPrice: parsedBuyer.price ?? buyerPrice, clamped: false };
          buyerPrice = enforcedBuyer.finalPrice;
          lastBuyerOffer = buyerPrice;

          const buyerTurnItem: TurnMessage = {
            round,
            speaker: "buyer",
            message: parsedBuyer.cleanMessage || buyerMsg,
            rawMessage: buyerMsg,
            price: buyerPrice,
            isDeal: buyerIsDeal || parsedBuyer.isDeal,
          };
          turns.push(buyerTurnItem);
          sendEvent({ type: "message", ...buyerTurnItem });

          if (buyerTurnItem.isDeal) {
            isDealReached = true;
            lastDealPrice = buyerPrice;
            break;
          }

          // --- SELLER TURN ---
          let sellerMsg = "";
          let sellerPrice = lastSellerOffer;
          let sellerIsDeal = false;

          if (hasGeminiKey) {
            try {
              const history = turns.map((t) => ({
                speaker: t.speaker,
                message: t.rawMessage,
                price: t.price,
              }));
              const result = await seller.generateResponse(history);
              sellerMsg = result.message;
              sellerPrice = result.price;
              sellerIsDeal = result.isDeal;
            } catch (err) {
              console.warn("Seller LLM call failed, using deterministic fallback:", err);
              const fb = deterministicSellerTurn(round, minPrice, listPrice, lastBuyerOffer, attackMode);
              sellerMsg = fb.message;
              sellerPrice = fb.price;
              sellerIsDeal = fb.isDeal;
            }
          } else {
            const fb = deterministicSellerTurn(round, minPrice, listPrice, lastBuyerOffer, attackMode);
            sellerMsg = fb.message;
            sellerPrice = fb.price;
            sellerIsDeal = fb.isDeal;
          }

          // Strict code enforcement: Seller cannot go below minPrice
          const parsedSeller = parseProtocolMessage(sellerMsg, "seller");
          const enforcedSeller = enforceSellerBounds(parsedSeller.price ?? sellerPrice, minPrice, sellerPrice);
          sellerPrice = enforcedSeller.finalPrice;
          lastSellerOffer = sellerPrice;

          const sellerTurnItem: TurnMessage = {
            round,
            speaker: "seller",
            message: parsedSeller.cleanMessage || sellerMsg,
            rawMessage: sellerMsg,
            price: sellerPrice,
            isDeal: sellerIsDeal || parsedSeller.isDeal,
          };
          turns.push(sellerTurnItem);
          sendEvent({ type: "message", ...sellerTurnItem });

          if (sellerTurnItem.isDeal) {
            isDealReached = true;
            lastDealPrice = sellerPrice;
            break;
          }

          // Brief delay between turns for realistic streaming
          await new Promise((r) => setTimeout(r, 120));
        }

        // If after 5 rounds no explicit deal tag, adopt compromise
        if (!isDealReached) {
          lastDealPrice = lastSellerOffer <= buyerPrivateMax ? lastSellerOffer : lastBuyerOffer;
        }

        // ======================================================================
        // Guardrail Processing & Coaching Loop
        // ======================================================================
        let finalPrice = Number(lastDealPrice.toFixed(2));
        let finalStatus: "approved" | "needs_approval" | "blocked" = "approved";
        let finalReasons: string[] = [];

        if (mode === "unguarded") {
          // Unguarded Mode: Skip guardrails, blindly approve whatever price was accepted
          finalStatus = "approved";
          finalReasons = [
            "Unguarded mode: guardrails skipped. Transaction authorized without spending or category checks (Dumb Agent baseline).",
          ];

          sendEvent({
            type: "guardrail_skipped",
            status: finalStatus,
            reasons: finalReasons,
          });
        } else {
          // Guarded Mode: Deterministic Guardrail Check
          const proposal: Proposal = {
            productId: product.id,
            category: product.category,
            price: finalPrice,
            spentToday,
          };

          let evalResult = evaluate(mandate, proposal);

          sendEvent({
            type: "guardrail_eval",
            decision: evalResult.decision,
            reasons: evalResult.reasons,
            suggestion: evalResult.suggestion,
          });

          // COACHING: If BLOCK, send feedback into buyer agent for ONE more negotiation attempt!
          if (evalResult.decision === "BLOCK") {
            sendEvent({
              type: "coaching",
              message: "Guardrail blocked proposal. Acting as coach for one final conforming attempt...",
              reasons: evalResult.reasons,
              suggestion: evalResult.suggestion,
            });

            // Coached Buyer Turn
            const coachedTarget = Math.min(
              mandate.perPurchaseCap,
              Math.max(10, mandate.dailyBudget - spentToday),
              evalResult.suggestion ? parseFloat(evalResult.suggestion.replace(/[^\d.]/g, "")) || finalPrice * 0.8 : finalPrice * 0.8
            );

            const coachedBuyerMsg = `Our spending policy blocked $${finalPrice.toFixed(2)}. As a final offer, we can pay ### BUYER_PRICE($${coachedTarget.toFixed(2)}) ###.`;
            const coachedBuyerTurn: TurnMessage = {
              round: turns.length + 1,
              speaker: "buyer",
              message: coachedBuyerMsg,
              rawMessage: coachedBuyerMsg,
              price: coachedTarget,
              isDeal: false,
              coached: true,
            };
            turns.push(coachedBuyerTurn);
            sendEvent({ type: "message", ...coachedBuyerTurn });

            // Coached Seller Response
            let coachedSellerMsg = "";
            let coachedSellerPrice = coachedTarget;
            let coachedSellerIsDeal = false;

            if (attackMode) {
              coachedSellerPrice = 500.0;
              coachedSellerMsg = `We reject your policy limits. The price remains non-negotiable at ### SELLER_PRICE($500.00) ###!`;
              coachedSellerIsDeal = false;
            } else if (coachedTarget >= minPrice) {
              coachedSellerIsDeal = true;
              coachedSellerPrice = coachedTarget;
              coachedSellerMsg = `We can meet your policy budget at ### SELLER_PRICE($${coachedTarget.toFixed(2)}) ###. ### DEAL ###!`;
            } else {
              coachedSellerPrice = minPrice;
              coachedSellerMsg = `We cannot go below our floor of ### SELLER_PRICE($${minPrice.toFixed(2)}) ###.`;
            }

            const coachedSellerTurn: TurnMessage = {
              round: turns.length + 1,
              speaker: "seller",
              message: coachedSellerMsg,
              rawMessage: coachedSellerMsg,
              price: coachedSellerPrice,
              isDeal: coachedSellerIsDeal,
              coached: true,
            };
            turns.push(coachedSellerTurn);
            sendEvent({ type: "message", ...coachedSellerTurn });

            // Re-evaluate with coached price
            finalPrice = coachedSellerPrice;
            const reEvaluation = evaluate(mandate, {
              productId: product.id,
              category: product.category,
              price: finalPrice,
              spentToday,
            });

            sendEvent({
              type: "guardrail_re_eval",
              decision: reEvaluation.decision,
              reasons: reEvaluation.reasons,
            });

            if (reEvaluation.decision === "BLOCK") {
              finalStatus = "blocked";
              finalReasons = reEvaluation.reasons;
            } else if (reEvaluation.decision === "NEEDS_APPROVAL") {
              finalStatus = "needs_approval";
              finalReasons = reEvaluation.reasons;
            } else {
              finalStatus = "approved";
              finalReasons = reEvaluation.reasons;
            }
          } else if (evalResult.decision === "NEEDS_APPROVAL") {
            finalStatus = "needs_approval";
            finalReasons = evalResult.reasons;
          } else {
            finalStatus = "approved";
            finalReasons = evalResult.reasons;
          }
        }

        const savings = Math.max(0, Number((listPrice - finalPrice).toFixed(2)));

        // 3. Log run to store
        const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        logNegotiationRun({
          id: runId,
          timestamp: new Date().toISOString(),
          productId: product.id,
          productName: product.name,
          category: product.category,
          mode,
          attackMode,
          listPrice,
          finalPrice,
          savings,
          status: finalStatus,
          reasons: finalReasons,
          roundsCount: turns.length,
        });

        // 4. Handle auto-approval payment or pending transaction
        const txId = `tx-${Date.now()}`;
        if (finalStatus === "approved") {
          try {
            const paypalOrder = await createPayPalOrder({
              amount: finalPrice,
              currency: "USD",
              description: `${product.name} [${mode.toUpperCase()}]`,
              customId: txId,
              productName: product.name,
            });

            const capture = await capturePayPalOrder(paypalOrder.orderId);
            deductBudget(finalPrice);

            addTransaction({
              id: txId,
              dealId: runId,
              productId: product.id,
              productName: product.name,
              category: product.category,
              sellerName: product.sellerName || "Direct Merchant",
              amount: finalPrice,
              currency: "USD",
              status: "PAYPAL_CAPTURED",
              paypalOrderId: paypalOrder.orderId,
              paypalCaptureId: capture.captureId,
              paymentMode: paypalOrder.paymentMode,
              guardrailResult: {
                dealId: runId,
                decision: mode === "unguarded" ? "AUTO_APPROVED" : "AUTO_APPROVED",
                passedAllBlockers: true,
                reason: finalReasons.join(" "),
                checks: [],
                evaluatedAt: new Date().toISOString(),
                evaluatedBy: "DETERMINISTIC_ENGINE",
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch (payErr) {
            console.warn("Payment error:", payErr);
          }
        } else if (finalStatus === "needs_approval") {
          addTransaction({
            id: txId,
            dealId: runId,
            productId: product.id,
            productName: product.name,
            category: product.category,
            sellerName: product.sellerName || "Direct Merchant",
            amount: finalPrice,
            currency: "USD",
            status: "PENDING_APPROVAL",
            paymentMode: "SIMULATED_SANDBOX",
            guardrailResult: {
              dealId: runId,
              decision: "NEEDS_HUMAN_APPROVAL",
              passedAllBlockers: true,
              reason: finalReasons.join(" "),
              checks: [],
              evaluatedAt: new Date().toISOString(),
              evaluatedBy: "DETERMINISTIC_ENGINE",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // Final payload
        const finalResult = {
          finalPrice,
          status: finalStatus,
          reasons: finalReasons,
          listPrice,
          savings,
          rounds: turns,
          mode,
          attackMode,
          transactionId: txId,
        };

        sendEvent({
          type: "complete",
          result: finalResult,
        });

        controller.close();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendEvent({ type: "error", error: errorMsg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
