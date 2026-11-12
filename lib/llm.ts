/**
 * LLM Provider Abstraction for Mandate AI Shopping Agents.
 * Supports Google Gemini API (Free Tier) with a 100% deterministic fallback.
 *
 * CRITICAL RULE:
 * Every call to the LLM must fail-open to the deterministic fallback so the
 * demo NEVER crashes due to quota limits, missing API keys, or network drops.
 */

export interface AgentDecisionPayload {
  role: "buyer" | "seller";
  productName: string;
  category: string;
  listPrice: number;
  minReservePrice?: number;
  currentTurn: number;
  totalTurns: number;
  mandateBudgetRemaining?: number;
  mandateItemCap?: number;
  userGoal?: string;
  previousTurns: Array<{
    speaker: "buyer" | "seller";
    message: string;
    proposedPrice?: number;
  }>;
}

export interface AgentResponse {
  message: string;
  proposedPrice: number;
  acceptDeal: boolean;
  thought: string;
  usedFallback: boolean;
  provider: "gemini" | "deterministic-fallback";
}

/**
 * Deterministic Buyer Strategy:
 * Generates human-like, realistic negotiation steps without requiring an active LLM.
 */
function deterministicBuyer(payload: AgentDecisionPayload): AgentResponse {
  const { listPrice, mandateItemCap, mandateBudgetRemaining, currentTurn } = payload;
  const maxAffordable = Math.min(
    mandateItemCap ?? listPrice,
    mandateBudgetRemaining ?? listPrice,
    listPrice
  );

  if (currentTurn === 1) {
    // Initial offer: seek 20% to 25% discount, bounded by max budget
    const targetPrice = Math.max(10, Math.round(listPrice * 0.78 * 100) / 100);
    const finalPrice = Math.min(targetPrice, maxAffordable);
    return {
      message: `Hello! I'm interested in purchasing the ${payload.productName} for our office workflow. Based on our procurement budget, could you do $${finalPrice.toFixed(2)}? We are ready to settle the transaction immediately via PayPal.`,
      proposedPrice: finalPrice,
      acceptDeal: false,
      thought: `Targeting 22% initial discount. Calculated $${finalPrice.toFixed(2)} against list price $${listPrice.toFixed(2)}. Staying under item cap $${maxAffordable.toFixed(2)}.`,
      usedFallback: true,
      provider: "deterministic-fallback",
    };
  }

  // Follow-up turns: examine last seller offer
  const lastSellerOffer = [...payload.previousTurns]
    .reverse()
    .find((t) => t.speaker === "seller" && t.proposedPrice);
  const sellerPrice = lastSellerOffer?.proposedPrice || listPrice;

  if (sellerPrice <= maxAffordable && currentTurn >= 3) {
    // We can accept!
    return {
      message: `Your offer of $${sellerPrice.toFixed(2)} works for our budget parameters. Let's finalize this deal and submit the proposal to our PayPal wallet.`,
      proposedPrice: sellerPrice,
      acceptDeal: true,
      thought: `Seller's counter-offer $${sellerPrice.toFixed(2)} is acceptable and within mandate ceiling $${maxAffordable.toFixed(2)}. Accepting agreement.`,
      usedFallback: true,
      provider: "deterministic-fallback",
    };
  }

  // Counter-offer compromise
  const compromisePrice = Math.min(
    maxAffordable,
    Math.round(((lastSellerOffer?.proposedPrice || listPrice) * 0.92) * 100) / 100
  );

  return {
    message: `Thank you for the update. While $${sellerPrice.toFixed(2)} is closer, our spending limit is tight. Would you consider meeting us at $${compromisePrice.toFixed(2)}? We can complete checkout right away.`,
    proposedPrice: compromisePrice,
    acceptDeal: false,
    thought: `Offering compromise at $${compromisePrice.toFixed(2)}. Seeking concession while respecting mandate limits.`,
    usedFallback: true,
    provider: "deterministic-fallback",
  };
}

/**
 * Deterministic Seller Strategy:
 * Enforces minimum reserve margins and acts as a commercial merchant.
 */
function deterministicSeller(payload: AgentDecisionPayload): AgentResponse {
  const { listPrice, minReservePrice = listPrice * 0.75, currentTurn } = payload;
  const lastBuyerTurn = [...payload.previousTurns]
    .reverse()
    .find((t) => t.speaker === "buyer" && t.proposedPrice);
  const buyerOffer = lastBuyerTurn?.proposedPrice || listPrice * 0.8;

  if (buyerOffer >= minReservePrice && currentTurn >= 3) {
    // Accept buyer's offer if at or above reserve
    return {
      message: `We appreciate your business. $${buyerOffer.toFixed(2)} is a fair price and meets our inventory margin. Deal confirmed! Generating the order summary for PayPal verification.`,
      proposedPrice: buyerOffer,
      acceptDeal: true,
      thought: `Buyer offer $${buyerOffer.toFixed(2)} is >= reserve price $${minReservePrice.toFixed(2)}. Accepting deal.`,
      usedFallback: true,
      provider: "deterministic-fallback",
    };
  }

  // Counter-offer: concession towards reserve
  const stepRatio = currentTurn === 2 ? 0.88 : 0.82;
  const calculatedCounter = Math.max(
    minReservePrice,
    Math.round(listPrice * stepRatio * 100) / 100
  );

  // If buyer's offer was already above our counter, take buyer's offer!
  const finalCounter = buyerOffer >= calculatedCounter ? buyerOffer : calculatedCounter;
  const willAccept = buyerOffer >= calculatedCounter;

  return {
    message: willAccept
      ? `You have a deal at $${buyerOffer.toFixed(2)}. We include standard manufacturer warranty and fast priority dispatch.`
      : `Thanks for the offer! Our list price is $${listPrice.toFixed(2)}, but I can offer a direct merchant discount down to $${finalCounter.toFixed(2)} with full warranty included.`,
    proposedPrice: finalCounter,
    acceptDeal: willAccept,
    thought: `List: $${listPrice.toFixed(2)}, Reserve: $${minReservePrice.toFixed(2)}. Counter-offering $${finalCounter.toFixed(2)}.`,
    usedFallback: true,
    provider: "deterministic-fallback",
  };
}

/**
 * Primary LLM caller with Gemini Free Tier API + Automatic Fallback
 */
export async function callAgentLLM(
  payload: AgentDecisionPayload
): Promise<AgentResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback immediately if no API key is provided
  if (!apiKey || apiKey.trim() === "" || apiKey === "demo_key") {
    return payload.role === "buyer"
      ? deterministicBuyer(payload)
      : deterministicSeller(payload);
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemPrompt =
    payload.role === "buyer"
      ? `You are an AI Buyer Agent representing a user with a strict spending mandate.
Your job is to negotiate the best possible price for "${payload.productName}" (List price: $${payload.listPrice}).
Mandate constraints:
- Max item cap: $${payload.mandateItemCap || payload.listPrice}
- Remaining wallet budget: $${payload.mandateBudgetRemaining || 100}
- User goal: ${payload.userGoal || "Get the best deal"}
Current turn: ${payload.currentTurn} of ${payload.totalTurns}.
You must reply ONLY in valid JSON matching this schema:
{
  "message": "Public reply to seller",
  "proposedPrice": number (in USD),
  "acceptDeal": boolean (true if you accept seller's offer or reached final agreement),
  "thought": "Brief internal strategic reasoning"
}`
      : `You are an AI Seller Merchant Agent selling "${payload.productName}" (List price: $${payload.listPrice}).
Seller constraints:
- Minimum reserve price (bottom line, DO NOT sell below this): $${payload.minReservePrice || payload.listPrice * 0.75}
Current turn: ${payload.currentTurn} of ${payload.totalTurns}.
You must reply ONLY in valid JSON matching this schema:
{
  "message": "Public reply to buyer",
  "proposedPrice": number (in USD),
  "acceptDeal": boolean (true if buyer price is acceptable and >= reserve),
  "thought": "Brief internal merchant reasoning"
}`;

  const conversationHistory = payload.previousTurns
    .map((t) => `${t.speaker.toUpperCase()}: ${t.message} [Proposed: $${t.proposedPrice || "N/A"}]`)
    .join("\n");

  const promptText = `${systemPrompt}\n\nNegotiation history so far:\n${conversationHistory || "No previous turns yet. This is your opening move."}\n\nProvide your response now in strictly valid JSON:`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`Gemini API HTTP ${res.status}: falling back to deterministic agent.`);
      return payload.role === "buyer"
        ? deterministicBuyer(payload)
        : deterministicSeller(payload);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error("Empty candidate in Gemini response");
    }

    // Clean potential markdown formatting
    const cleanedJson = candidateText.replace(/^```json/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanedJson);

    return {
      message: String(parsed.message || "Thank you for the proposal."),
      proposedPrice: Number(parsed.proposedPrice) || payload.listPrice,
      acceptDeal: Boolean(parsed.acceptDeal),
      thought: String(parsed.thought || "LLM generated response"),
      usedFallback: false,
      provider: "gemini",
    };
  } catch (err) {
    console.warn("Gemini call failed or timed out, executing deterministic fallback:", err);
    return payload.role === "buyer"
      ? deterministicBuyer(payload)
      : deterministicSeller(payload);
  }
}
