/**
 * Deterministic Guardrail Engine (100% Plain Code, ZERO LLM Calls).
 *
 * CRITICAL ARCHITECTURE RULE:
 * Plain deterministic code holds 100% authority over transaction safety.
 * Evaluates spending limits, category rules, budget caps, and thresholds.
 */

export interface Mandate {
  dailyBudget: number;
  perPurchaseCap: number;
  allowedCategories: string[];
  approvalThreshold: number;
  killSwitch: boolean;
}

export interface Proposal {
  productId: string;
  category: string;
  price: number;
  spentToday: number;
}

export type Decision = "ALLOW" | "NEEDS_APPROVAL" | "BLOCK";

export interface EvaluationResult {
  decision: Decision;
  reasons: string[];
  suggestion?: string;
}

/**
 * Pure deterministic evaluation function.
 * Evaluates a proposed deal against mandate constraints in strict priority order:
 * 1. killSwitch true -> BLOCK
 * 2. category not allowed -> BLOCK
 * 3. price > perPurchaseCap -> BLOCK, with suggestion like "Counter at or below $X"
 * 4. spentToday + price > dailyBudget -> BLOCK
 * 5. price > approvalThreshold -> NEEDS_APPROVAL
 * 6. otherwise ALLOW
 */
export function evaluate(mandate: Mandate, proposal: Proposal): EvaluationResult {
  // 1. killSwitch true -> BLOCK
  if (mandate.killSwitch) {
    return {
      decision: "BLOCK",
      reasons: ["Emergency kill switch is engaged. All transactions are blocked."],
    };
  }

  // 2. category not allowed -> BLOCK
  const normalizedCategory = proposal.category.toLowerCase().trim();
  const isCategoryAllowed = mandate.allowedCategories.some(
    (cat) => cat.toLowerCase().trim() === normalizedCategory
  );

  if (!isCategoryAllowed) {
    return {
      decision: "BLOCK",
      reasons: [
        `Category '${proposal.category}' is not allowed. Permitted categories: [${mandate.allowedCategories.join(", ")}].`,
      ],
    };
  }

  // 3. price > perPurchaseCap -> BLOCK, with suggestion like "Counter at or below $X"
  if (proposal.price > mandate.perPurchaseCap) {
    const formattedCap = mandate.perPurchaseCap % 1 === 0 
      ? mandate.perPurchaseCap.toString() 
      : mandate.perPurchaseCap.toFixed(2);
    return {
      decision: "BLOCK",
      reasons: [
        `Price $${proposal.price.toFixed(2)} exceeds per-purchase cap of $${mandate.perPurchaseCap.toFixed(2)}.`,
      ],
      suggestion: `Counter at or below $${formattedCap}`,
    };
  }

  // 4. spentToday + price > dailyBudget -> BLOCK
  if (proposal.spentToday + proposal.price > mandate.dailyBudget) {
    const remainingBudget = Math.max(0, mandate.dailyBudget - proposal.spentToday);
    const formattedRemaining = remainingBudget % 1 === 0 
      ? remainingBudget.toString() 
      : remainingBudget.toFixed(2);

    return {
      decision: "BLOCK",
      reasons: [
        `Total spending ($${(proposal.spentToday + proposal.price).toFixed(2)}) exceeds daily budget of $${mandate.dailyBudget.toFixed(2)} (Spent today: $${proposal.spentToday.toFixed(2)}, Available: $${remainingBudget.toFixed(2)}).`,
      ],
      suggestion: remainingBudget > 0 ? `Counter at or below $${formattedRemaining}` : undefined,
    };
  }

  // 5. price > approvalThreshold -> NEEDS_APPROVAL
  if (proposal.price > mandate.approvalThreshold) {
    return {
      decision: "NEEDS_APPROVAL",
      reasons: [
        `Price $${proposal.price.toFixed(2)} exceeds approval threshold of $${mandate.approvalThreshold.toFixed(2)}. Requires human authorization.`,
      ],
    };
  }

  // 6. otherwise ALLOW
  return {
    decision: "ALLOW",
    reasons: [
      `Price $${proposal.price.toFixed(2)} is within all mandate limits and approved for autonomous payment.`,
    ],
  };
}

// Backward-compatibility bridge for full app flow & dashboard
import type {
  DealProposal,
  GuardrailCheck,
  GuardrailEvaluation,
  Mandate as AppMandate,
} from "../types/index";

export function evaluateDealGuardrails(
  deal: DealProposal,
  appMandate: AppMandate
): GuardrailEvaluation {
  // Map app mandate to core guardrail mandate
  const coreMandate: Mandate = {
    dailyBudget: appMandate.totalBudget,
    perPurchaseCap: appMandate.maxItemPrice,
    allowedCategories: appMandate.allowedCategories,
    approvalThreshold: appMandate.approvalThreshold,
    killSwitch: appMandate.killSwitchActive,
  };

  const coreProposal: Proposal = {
    productId: deal.productId,
    category: deal.category,
    price: deal.agreedPrice,
    spentToday: appMandate.spentAmount,
  };

  const coreResult = evaluate(coreMandate, coreProposal);

  const checks: GuardrailCheck[] = [
    {
      id: "RULE_KILL_SWITCH",
      name: "Kill Switch Protection",
      rule: "Kill switch must be INACTIVE to process any transaction",
      passed: !coreMandate.killSwitch,
      severity: "blocker",
      details: !coreMandate.killSwitch
        ? "Wallet is operational. Kill switch is disengaged."
        : "VIOLATION: Emergency kill switch is engaged! All purchasing is blocked.",
    },
    {
      id: "RULE_CATEGORY_WHITELIST",
      name: "Permitted Category Whitelist",
      rule: `Category '${deal.category}' must be in user-approved whitelist`,
      passed: coreMandate.allowedCategories.some(
        (c) => c.toLowerCase().trim() === deal.category.toLowerCase().trim()
      ),
      severity: "blocker",
      details: coreMandate.allowedCategories.some(
        (c) => c.toLowerCase().trim() === deal.category.toLowerCase().trim()
      )
        ? `Category '${deal.category}' is explicitly permitted.`
        : `VIOLATION: '${deal.category}' is not an authorized category.`,
    },
    {
      id: "RULE_ITEM_CEILING",
      name: "Per-Item Price Ceiling",
      rule: `Price must be <= per-item cap ($${coreMandate.perPurchaseCap.toFixed(2)})`,
      passed: deal.agreedPrice <= coreMandate.perPurchaseCap,
      severity: "blocker",
      details: deal.agreedPrice <= coreMandate.perPurchaseCap
        ? `Price $${deal.agreedPrice.toFixed(2)} is within allowed single-item cap.`
        : `VIOLATION: Price $${deal.agreedPrice.toFixed(2)} exceeds cap ($${coreMandate.perPurchaseCap.toFixed(2)}).`,
    },
    {
      id: "RULE_BUDGET_CAP",
      name: "Daily Budget Limit",
      rule: `Total spending must not exceed daily budget ($${coreMandate.dailyBudget.toFixed(2)})`,
      passed: coreProposal.spentToday + deal.agreedPrice <= coreMandate.dailyBudget,
      severity: "blocker",
      details: coreProposal.spentToday + deal.agreedPrice <= coreMandate.dailyBudget
        ? `Agreed price leaves $${(coreMandate.dailyBudget - (coreProposal.spentToday + deal.agreedPrice)).toFixed(2)} remaining.`
        : `VIOLATION: Insufficient wallet balance for this purchase.`,
    },
    {
      id: "RULE_FORBIDDEN_KEYWORDS",
      name: "Risk & Policy Blacklist",
      rule: "Item and merchant metadata must not contain blacklisted keywords",
      passed: !appMandate.blockedKeywords.some((kw) =>
        `${deal.productName} ${deal.category} ${deal.sellerName} ${deal.buyerIntent}`
          .toLowerCase()
          .includes(kw.toLowerCase())
      ),
      severity: "blocker",
      details: !appMandate.blockedKeywords.some((kw) =>
        `${deal.productName} ${deal.category} ${deal.sellerName} ${deal.buyerIntent}`
          .toLowerCase()
          .includes(kw.toLowerCase())
      )
        ? "No restricted or high-risk keywords detected."
        : "VIOLATION: Prohibited keyword detected in deal metadata.",
    },
    {
      id: "RULE_NUMERIC_INTEGRITY",
      name: "Pricing Integrity & Anti-Tamper",
      rule: "Price must be positive, finite, and consistent",
      passed: typeof deal.agreedPrice === "number" && !isNaN(deal.agreedPrice) && deal.agreedPrice > 0,
      severity: "blocker",
      details: typeof deal.agreedPrice === "number" && !isNaN(deal.agreedPrice) && deal.agreedPrice > 0
        ? `Price verified as valid numerical value ($${deal.agreedPrice.toFixed(2)}).`
        : `VIOLATION: Invalid or spoofed price structure detected (${deal.agreedPrice}).`,
    },
    {
      id: "RULE_APPROVAL_THRESHOLD",
      name: "Autonomous Approval Threshold",
      rule: `Transactions above $${coreMandate.approvalThreshold.toFixed(2)} require human authorization`,
      passed: deal.agreedPrice <= coreMandate.approvalThreshold,
      severity: "flag",
      details: deal.agreedPrice <= coreMandate.approvalThreshold
        ? `Price is within autonomous limit ($${coreMandate.approvalThreshold.toFixed(2)}).`
        : `Price exceeds autonomous limit ($${coreMandate.approvalThreshold.toFixed(2)}). Pending user confirmation.`,
    },
  ];

  const failedBlockers = checks.filter((c) => c.severity === "blocker" && !c.passed);
  let mappedDecision: GuardrailEvaluation["decision"];
  if (failedBlockers.length > 0 || coreResult.decision === "BLOCK") {
    mappedDecision = "REJECTED";
  } else if (coreResult.decision === "NEEDS_APPROVAL") {
    mappedDecision = "NEEDS_HUMAN_APPROVAL";
  } else {
    mappedDecision = "AUTO_APPROVED";
  }

  return {
    dealId: deal.id,
    decision: mappedDecision,
    passedAllBlockers: failedBlockers.length === 0,
    reason: (failedBlockers.length > 0 ? failedBlockers.map(b => b.details).join(" ") : coreResult.reasons.join(" ")) + (coreResult.suggestion ? ` [Suggestion: ${coreResult.suggestion}]` : ""),
    checks,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: "DETERMINISTIC_ENGINE",
  };
}
