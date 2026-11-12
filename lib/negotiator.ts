import type { CatalogProduct, DealProposal, Mandate, NegotiationTurn } from "../types/index.ts";
import { callAgentLLM } from "./llm.ts";

export interface RunNegotiationParams {
  product: CatalogProduct;
  mandate: Mandate;
  buyerIntent?: string;
  maxTurns?: number;
}

/**
 * Orchestrates Buyer AI vs Seller AI negotiation.
 * Both agents participate in structured turns, communicating offers, counter-offers,
 * and transparent internal reasoning thoughts.
 */
export async function runAgentNegotiation({
  product,
  mandate,
  buyerIntent = `Acquire ${product.name} within authorized budget guidelines`,
  maxTurns = 4,
}: RunNegotiationParams): Promise<DealProposal> {
  const turns: NegotiationTurn[] = [];
  let isAgreed = false;
  let finalAgreedPrice = product.listPrice;

  // Multi-turn loop
  for (let turnIndex = 1; turnIndex <= maxTurns; turnIndex++) {
    // 1. BUYER TURN
    const buyerHistory = turns.map((t) => ({
      speaker: t.speaker,
      message: t.message,
      proposedPrice: t.proposedPrice,
    }));

    const buyerResponse = await callAgentLLM({
      role: "buyer",
      productName: product.name,
      category: product.category,
      listPrice: product.listPrice,
      currentTurn: turnIndex,
      totalTurns: maxTurns,
      mandateBudgetRemaining: mandate.remainingBudget,
      mandateItemCap: mandate.maxItemPrice,
      userGoal: buyerIntent,
      previousTurns: buyerHistory,
    });

    turns.push({
      turn: turns.length + 1,
      speaker: "buyer",
      speakerName: "Mandate Buyer AI",
      message: buyerResponse.message,
      proposedPrice: buyerResponse.proposedPrice,
      thought: buyerResponse.thought,
      timestamp: new Date().toISOString(),
    });

    if (buyerResponse.acceptDeal) {
      isAgreed = true;
      finalAgreedPrice = buyerResponse.proposedPrice;
      break;
    }

    // 2. SELLER TURN
    const sellerHistory = turns.map((t) => ({
      speaker: t.speaker,
      message: t.message,
      proposedPrice: t.proposedPrice,
    }));

    const sellerResponse = await callAgentLLM({
      role: "seller",
      productName: product.name,
      category: product.category,
      listPrice: product.listPrice,
      minReservePrice: product.minReservePrice,
      currentTurn: turnIndex,
      totalTurns: maxTurns,
      previousTurns: sellerHistory,
    });

    turns.push({
      turn: turns.length + 1,
      speaker: "seller",
      speakerName: product.sellerName,
      message: sellerResponse.message,
      proposedPrice: sellerResponse.proposedPrice,
      thought: sellerResponse.thought,
      timestamp: new Date().toISOString(),
    });

    if (sellerResponse.acceptDeal) {
      isAgreed = true;
      finalAgreedPrice = sellerResponse.proposedPrice;
      break;
    }
  }

  // If not explicitly flagged agreed after maxTurns, adopt last reasonable offer
  if (!isAgreed) {
    const lastSellerTurn = [...turns]
      .reverse()
      .find((t) => t.speaker === "seller" && t.proposedPrice);
    finalAgreedPrice = lastSellerTurn?.proposedPrice || product.listPrice;
    isAgreed = true;
  }

  const savings = Math.max(
    0,
    Number((product.listPrice - finalAgreedPrice).toFixed(2))
  );

  const proposal: DealProposal = {
    id: `deal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    productId: product.id,
    productName: product.name,
    category: product.category,
    listPrice: product.listPrice,
    agreedPrice: Number(finalAgreedPrice.toFixed(2)),
    savings,
    sellerName: product.sellerName,
    buyerIntent,
    turns,
    agreed: isAgreed,
    createdAt: new Date().toISOString(),
  };

  return proposal;
}
