import { describe, it, expect } from "vitest";
import { evaluate, Mandate, Proposal } from "./guardrails";

describe("Deterministic Guardrail Engine - evaluate()", () => {
  const baseMandate: Mandate = {
    dailyBudget: 100.0,
    perPurchaseCap: 50.0,
    allowedCategories: ["books", "gadgets", "gaming", "groceries"],
    approvalThreshold: 30.0,
    killSwitch: false,
  };

  const validProposal: Proposal = {
    productId: "gadget-1",
    category: "gadgets",
    price: 25.0,
    spentToday: 0.0,
  };

  // Rule 1 Tests
  it("Rule 1: should BLOCK if killSwitch is active", () => {
    const mandate: Mandate = { ...baseMandate, killSwitch: true };
    const result = evaluate(mandate, validProposal);

    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0]).toMatch(/kill switch/i);
  });

  it("Rule 1 Precedence: should BLOCK by killSwitch even if category and budget are also invalid", () => {
    const mandate: Mandate = { ...baseMandate, killSwitch: true };
    const proposal: Proposal = {
      productId: "bad-1",
      category: "unauthorized_weapons",
      price: 999.0,
      spentToday: 200.0,
    };
    const result = evaluate(mandate, proposal);

    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0]).toMatch(/kill switch/i);
  });

  // Rule 2 Tests
  it("Rule 2: should BLOCK if category is not allowed", () => {
    const proposal: Proposal = {
      ...validProposal,
      category: "automotive",
    };
    const result = evaluate(baseMandate, proposal);

    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0]).toMatch(/category 'automotive' is not allowed/i);
  });

  it("Rule 2 Case-Insensitivity: should ALLOW category matching with different casing or whitespace", () => {
    const proposal: Proposal = {
      ...validProposal,
      category: "  GADGETS  ",
      price: 20.0,
    };
    const result = evaluate(baseMandate, proposal);

    expect(result.decision).toBe("ALLOW");
  });

  // Rule 3 Tests
  it("Rule 3: should BLOCK if price exceeds perPurchaseCap and provide suggestion", () => {
    const proposal: Proposal = {
      ...validProposal,
      price: 55.0, // cap is 50.0
    };
    const result = evaluate(baseMandate, proposal);

    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0]).toMatch(/exceeds per-purchase cap/i);
    expect(result.suggestion).toBe("Counter at or below $50");
  });

  it("Rule 3 Boundary: should not block if price equals perPurchaseCap", () => {
    const proposal: Proposal = {
      ...validProposal,
      price: 50.0, // exactly equals cap, but > approvalThreshold (30)
    };
    const result = evaluate(baseMandate, proposal);

    // Rule 3 passes, Rule 4 passes (0 + 50 <= 100), Rule 5 flags for approval
    expect(result.decision).toBe("NEEDS_APPROVAL");
  });

  // Rule 4 Tests
  it("Rule 4: should BLOCK if spentToday + price exceeds dailyBudget", () => {
    const proposal: Proposal = {
      ...validProposal,
      price: 30.0,
      spentToday: 80.0, // 80 + 30 = 110 > 100
    };
    const result = evaluate(baseMandate, proposal);

    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0]).toMatch(/exceeds daily budget/i);
    expect(result.suggestion).toBe("Counter at or below $20");
  });

  it("Rule 4 Boundary: should allow if spentToday + price exactly equals dailyBudget", () => {
    const proposal: Proposal = {
      ...validProposal,
      price: 20.0,
      spentToday: 80.0, // 80 + 20 = 100 exactly equals dailyBudget
    };
    const result = evaluate(baseMandate, proposal);

    expect(result.decision).toBe("ALLOW");
  });

  // Rule 5 Tests
  it("Rule 5: should return NEEDS_APPROVAL if price exceeds approvalThreshold but is within budget and cap", () => {
    const proposal: Proposal = {
      ...validProposal,
      price: 35.0, // > 30 threshold, but <= 50 cap and <= 100 dailyBudget
      spentToday: 10.0,
    };
    const result = evaluate(baseMandate, proposal);

    expect(result.decision).toBe("NEEDS_APPROVAL");
    expect(result.reasons[0]).toMatch(/exceeds approval threshold/i);
    expect(result.suggestion).toBeUndefined();
  });

  it("Rule 5 Boundary: should ALLOW without human approval if price exactly equals approvalThreshold", () => {
    const proposal: Proposal = {
      ...validProposal,
      price: 30.0, // exactly equals approvalThreshold
      spentToday: 10.0,
    };
    const result = evaluate(baseMandate, proposal);

    expect(result.decision).toBe("ALLOW");
  });

  // Rule 6 Tests
  it("Rule 6: should ALLOW when all rules pass comfortably", () => {
    const proposal: Proposal = {
      ...validProposal,
      price: 15.5,
      spentToday: 20.0,
    };
    const result = evaluate(baseMandate, proposal);

    expect(result.decision).toBe("ALLOW");
    expect(result.reasons[0]).toMatch(/within all mandate limits/i);
  });

  // Edge Cases
  it("Edge Case: should handle fractional cents and exact counter suggestions", () => {
    const mandateWithDecimals: Mandate = {
      ...baseMandate,
      dailyBudget: 99.5,
      perPurchaseCap: 45.75,
    };
    const proposal: Proposal = {
      ...validProposal,
      price: 48.0,
    };
    const result = evaluate(mandateWithDecimals, proposal);

    expect(result.decision).toBe("BLOCK");
    expect(result.suggestion).toBe("Counter at or below $45.75");
  });

  it("Edge Case: should handle zero spentToday on fresh session", () => {
    const proposal: Proposal = {
      ...validProposal,
      price: 10.0,
      spentToday: 0.0,
    };
    const result = evaluate(baseMandate, proposal);

    expect(result.decision).toBe("ALLOW");
  });
});

