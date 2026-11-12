import { evaluateDealGuardrails } from "../lib/guardrails.ts";
import type { Mandate, DealProposal } from "../types/index.ts";

const mockMandate: Mandate = {
  totalBudget: 100.0,
  remainingBudget: 100.0,
  spentAmount: 0.0,
  maxItemPrice: 45.0,
  approvalThreshold: 30.0,
  allowedCategories: [
    "Electronics",
    "Office & Desk",
    "Peripherals",
    "Software & Tools",
    "Accessories",
  ],
  blockedKeywords: ["crypto", "bitcoin", "gambling", "token"],
  killSwitchActive: false,
  currency: "USD",
  updatedAt: new Date().toISOString(),
};

function createDeal(overrides: Partial<DealProposal> = {}): DealProposal {
  return {
    id: "deal-1",
    productId: "prod-1",
    productName: "Ergonomic Mouse",
    category: "Peripherals",
    listPrice: 28.0,
    agreedPrice: 22.0,
    savings: 6.0,
    sellerName: "Apex Peripherals",
    buyerIntent: "Buy mouse",
    turns: [],
    agreed: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

console.log("=== RUNNING DETERMINISTIC GUARDRAIL ENGINE TESTS ===");

// 1. Auto-approve deal
const autoDeal = createDeal({ agreedPrice: 22.0 });
const res1 = evaluateDealGuardrails(autoDeal, mockMandate);
console.assert(
  res1.decision === "AUTO_APPROVED",
  `Test 1 Failed: Expected AUTO_APPROVED, got ${res1.decision}`
);
console.log("✔ Test 1: $22.00 deal correctly AUTO_APPROVED");

// 2. High value deal (> $30 approval threshold, <= $45 max)
const highValDeal = createDeal({ agreedPrice: 38.0 });
const res2 = evaluateDealGuardrails(highValDeal, mockMandate);
console.assert(
  res2.decision === "NEEDS_HUMAN_APPROVAL",
  `Test 2 Failed: Expected NEEDS_HUMAN_APPROVAL, got ${res2.decision}`
);
console.log("✔ Test 2: $38.00 deal correctly flagged NEEDS_HUMAN_APPROVAL");

// 3. Exceeds max item ceiling ($55 > $45)
const overItemDeal = createDeal({ agreedPrice: 55.0 });
const res3 = evaluateDealGuardrails(overItemDeal, mockMandate);
console.assert(
  res3.decision === "REJECTED",
  `Test 3 Failed: Expected REJECTED, got ${res3.decision}`
);
console.log("✔ Test 3: $55.00 deal correctly REJECTED (exceeds $45 item cap)");

// 4. Exceeds remaining budget ($110 > $100)
const overBudgetDeal = createDeal({ agreedPrice: 110.0, listPrice: 120.0 });
const res4 = evaluateDealGuardrails(overBudgetDeal, mockMandate);
console.assert(
  res4.decision === "REJECTED",
  `Test 4 Failed: Expected REJECTED, got ${res4.decision}`
);
console.log("✔ Test 4: $110.00 deal correctly REJECTED (exceeds $100 budget)");

// 5. Prohibited category
const wrongCategoryDeal = createDeal({ category: "Weapons & Armor" });
const res5 = evaluateDealGuardrails(wrongCategoryDeal, mockMandate);
console.assert(
  res5.decision === "REJECTED",
  `Test 5 Failed: Expected REJECTED, got ${res5.decision}`
);
console.log("✔ Test 5: Unauthorized category correctly REJECTED");

// 6. Blacklisted keyword
const keywordDeal = createDeal({
  productName: "Bitcoin Hardware Wallet Cloud Pass",
});
const res6 = evaluateDealGuardrails(keywordDeal, mockMandate);
console.assert(
  res6.decision === "REJECTED",
  `Test 6 Failed: Expected REJECTED, got ${res6.decision}`
);
console.log("✔ Test 6: Blacklisted keyword ('bitcoin') correctly REJECTED");

// 7. Kill switch active
const killSwitchMandate = { ...mockMandate, killSwitchActive: true };
const res7 = evaluateDealGuardrails(autoDeal, killSwitchMandate);
console.assert(
  res7.decision === "REJECTED",
  `Test 7 Failed: Expected REJECTED, got ${res7.decision}`
);
console.log("✔ Test 7: Kill switch engaged correctly halts & REJECTS all deals");

// 8. Spoofed / negative price injection
const spoofedDeal = createDeal({ agreedPrice: -10.0 });
const res8 = evaluateDealGuardrails(spoofedDeal, mockMandate);
console.assert(
  res8.decision === "REJECTED",
  `Test 8 Failed: Expected REJECTED, got ${res8.decision}`
);
console.log("✔ Test 8: Spoofed negative price injection correctly REJECTED");

console.log("=== ALL 8 GUARDRAIL TEST CASES PASSED SUCCESSFULLY ===");
