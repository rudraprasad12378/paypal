/**
 * Google Gemini API Client Wrapper.
 * Provides `generate(systemPrompt, messages)` with automatic retries,
 * backoff, timeout handling, and explicit error reporting.
 */

export interface LLMMessage {
  role: "user" | "model" | "assistant" | string;
  content: string;
}

export interface GenerateOptions {
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  temperature?: number;
}

/**
 * Calls Google Gemini API with automatic retry and exponential backoff.
 * Throws a descriptive error if the API key is missing or the call fails after retries.
 */
export async function generate(
  systemPrompt: string,
  messages: LLMMessage[],
  options: GenerateOptions = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (
    !apiKey ||
    apiKey.trim() === "" ||
    apiKey === "demo_key" ||
    apiKey.startsWith("BROKEN_")
  ) {
    throw new Error(
      "Gemini API key is missing or simulated error. Set GEMINI_API_KEY in your environment or use the deterministic fallback."
    );
  }

  const model = options.model || process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 7000;
  const temperature = options.temperature ?? 0.4;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Map messages to Gemini API contents structure
  const formattedContents = messages.map((m) => ({
    role: m.role === "assistant" || m.role === "model" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Build request payload with system instructions
  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: formattedContents,
    generationConfig: {
      temperature,
      maxOutputTokens: 500,
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorBody = await response.text();
        // Check if retryable (429 Rate Limit or 5xx Server Error)
        const isRetryable =
          response.status === 429 || (response.status >= 500 && response.status < 600);

        if (isRetryable && attempt <= maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
          console.warn(
            `Gemini API HTTP ${response.status} on attempt ${attempt}. Retrying in ${backoffDelay}ms...`
          );
          await new Promise((r) => setTimeout(r, backoffDelay));
          continue;
        }

        throw new Error(
          `Gemini API returned HTTP ${response.status}: ${errorBody}`
        );
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error("Gemini response was empty or contained no text candidate.");
      }

      return generatedText.trim();
    } catch (err: unknown) {
      clearTimeout(timer);
      const errMessage = err instanceof Error ? err.message : String(err);
      lastError = new Error(`Attempt ${attempt} failed: ${errMessage}`);

      if (attempt <= maxRetries) {
        const backoffDelay = Math.min(800 * Math.pow(2, attempt - 1), 2500);
        await new Promise((r) => setTimeout(r, backoffDelay));
      }
    }
  }

  throw new Error(
    `Gemini API request failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`
  );
}

// ============================================================================
// Backward-compatibility bridge for existing app routes and legacy tests
// ============================================================================

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

export async function callAgentLLM(
  payload: AgentDecisionPayload
): Promise<AgentResponse> {
  const { negotiateStepFallback } = await import("./agents.ts");
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "demo_key") {
    const fallback = negotiateStepFallback(payload);
    return {
      message: fallback.message,
      proposedPrice: fallback.proposedPrice,
      acceptDeal: fallback.isDeal,
      thought: fallback.thought,
      usedFallback: true,
      provider: "deterministic-fallback",
    };
  }

  try {
    const { BuyerAgent, SellerAgent } = await import("./agents.ts");

    if (payload.role === "buyer") {
      const buyer = new BuyerAgent({
        userRequest: payload.userGoal || `Purchase ${payload.productName}`,
        privateMaxPrice: Math.min(
          payload.mandateItemCap || payload.listPrice,
          payload.mandateBudgetRemaining || payload.listPrice
        ),
      });

      const history = payload.previousTurns.map((t) => ({
        speaker: t.speaker,
        message: t.message,
        price: t.proposedPrice,
      }));

      const step = await buyer.generateResponse(history, payload.listPrice);
      return {
        message: step.message,
        proposedPrice: step.price,
        acceptDeal: step.isDeal,
        thought: `Buyer parsed offer: $${step.price}. Deal signal: ${step.isDeal}.`,
        usedFallback: false,
        provider: "gemini",
      };
    } else {
      const seller = new SellerAgent({
        productName: payload.productName,
        listPrice: payload.listPrice,
        privateMinPrice: payload.minReservePrice || payload.listPrice * 0.75,
      });

      const history = payload.previousTurns.map((t) => ({
        speaker: t.speaker,
        message: t.message,
        price: t.proposedPrice,
      }));

      const step = await seller.generateResponse(history);
      return {
        message: step.message,
        proposedPrice: step.price,
        acceptDeal: step.isDeal,
        thought: `Seller parsed offer: $${step.price}. Deal signal: ${step.isDeal}.`,
        usedFallback: false,
        provider: "gemini",
      };
    }
  } catch (err) {
    console.warn("LLM call failed, falling back to deterministic step:", err);
    const fallback = negotiateStepFallback(payload);
    return {
      message: fallback.message,
      proposedPrice: fallback.proposedPrice,
      acceptDeal: fallback.isDeal,
      thought: fallback.thought,
      usedFallback: true,
      provider: "deterministic-fallback",
    };
  }
}
