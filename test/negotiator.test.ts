import { runAgentNegotiation } from "../lib/negotiator.ts";
import { INITIAL_CATALOG } from "../lib/catalog.ts";
import { DEFAULT_MANDATE } from "../lib/store.ts";

console.log("=== RUNNING MULTI-TURN AI NEGOTIATION TEST ===");

async function test() {
  const mouseProduct = INITIAL_CATALOG[0]; // Ergonomic Vertical Mouse ($28 list, $19 min)
  console.log(`Starting negotiation for: ${mouseProduct.name} (List: $${mouseProduct.listPrice}, Reserve: $${mouseProduct.minReservePrice})`);

  const deal = await runAgentNegotiation({
    product: mouseProduct,
    mandate: DEFAULT_MANDATE,
    buyerIntent: "Acquire mouse under $25 budget",
    maxTurns: 3,
  });

  console.log(`\nNegotiation Concluded! Total Turns: ${deal.turns.length}`);
  for (const t of deal.turns) {
    console.log(`[Turn ${t.turn}] ${t.speaker.toUpperCase()} (${t.speakerName}): "${t.message}" | Price: $${t.proposedPrice}`);
    console.log(`  -> Thought: ${t.thought}`);
  }

  console.log(`\nFinal Agreed Price: $${deal.agreedPrice}`);
  console.log(`Savings achieved: $${deal.savings}`);
  console.assert(deal.agreedPrice <= mouseProduct.listPrice, "Agreed price should not exceed list price");
  console.assert(deal.agreedPrice >= mouseProduct.minReservePrice, "Agreed price should be >= seller reserve");
  console.assert(deal.turns.length >= 2, "Negotiation should have at least 2 turns");
  console.log("✔ AI Negotiation flow verified successfully!");
}

test().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
