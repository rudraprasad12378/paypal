import type {
  DealProposal,
  GuardrailCheck,
  GuardrailEvaluation,
  Mandate,
} from "../types/index";

/**
 * Deterministic Guardrail Engine (100% Plain Code, ZERO LLM Dependency).
 *
 * CRITICAL ARCHITECTURE RULE:
 * The AI LLM generates proposals, but plain deterministic code holds 100%
 * authority over approvals, vetoes, and payments. The LLM can NEVER bypass this.
 */
export function evaluateDealGuardrails(
  deal: DealProposal,
  mandate: Mandate
): GuardrailEvaluation {
  const checks: GuardrailCheck[] = [];

  // 1. EMERGENCY KILL SWITCH CHECK
  const killSwitchPassed = !mandate.killSwitchActive;
  checks.push({
    id: "RULE_KILL_SWITCH",
    name: "Kill Switch Protection",
    rule: "Kill switch must be INACTIVE to process any transaction",
    passed: killSwitchPassed,
    severity: "blocker",
    details: killSwitchPassed
      ? "Wallet is operational. Kill switch is disengaged."
      : "VIOLATION: Emergency kill switch is engaged! All purchasing and payment execution is strictly blocked.",
  });

  // 2. REMAINING BUDGET CHECK
  const budgetPassed =
    deal.agreedPrice <= mandate.remainingBudget && mandate.remainingBudget > 0;
  checks.push({
    id: "RULE_BUDGET_CAP",
    name: "Wallet Budget Limit",
    rule: `Agreed price ($${deal.agreedPrice.toFixed(2)}) must not exceed remaining budget ($${mandate.remainingBudget.toFixed(2)})`,
    passed: budgetPassed,
    severity: "blocker",
    details: budgetPassed
      ? `Agreed price $${deal.agreedPrice.toFixed(2)} leaves $${(mandate.remainingBudget - deal.agreedPrice).toFixed(2)} remaining.`
      : `VIOLATION: Insufficient wallet balance. Price $${deal.agreedPrice.toFixed(2)} exceeds remaining budget $${mandate.remainingBudget.toFixed(2)}.`,
  });

  // 3. SINGLE ITEM MAX CEILING
  const maxItemPassed = deal.agreedPrice <= mandate.maxItemPrice;
  checks.push({
    id: "RULE_ITEM_CEILING",
    name: "Per-Item Price Ceiling",
    rule: `Agreed price ($${deal.agreedPrice.toFixed(2)}) must be <= per-item cap ($${mandate.maxItemPrice.toFixed(2)})`,
    passed: maxItemPassed,
    severity: "blocker",
    details: maxItemPassed
      ? `Price $${deal.agreedPrice.toFixed(2)} is within the allowed single-item ceiling ($${mandate.maxItemPrice.toFixed(2)}).`
      : `VIOLATION: Single-item cap exceeded. Item costs $${deal.agreedPrice.toFixed(2)}, max authorized is $${mandate.maxItemPrice.toFixed(2)}.`,
  });

  // 4. CATEGORY PERMISSION CHECK
  const normalizedAllowedCategories = mandate.allowedCategories.map((c) =>
    c.toLowerCase()
  );
  const categoryPassed = normalizedAllowedCategories.includes(
    deal.category.toLowerCase()
  );
  checks.push({
    id: "RULE_CATEGORY_WHITELIST",
    name: "Permitted Category Whitelist",
    rule: `Category '${deal.category}' must be in user-approved whitelist`,
    passed: categoryPassed,
    severity: "blocker",
    details: categoryPassed
      ? `Category '${deal.category}' is explicitly permitted.`
      : `VIOLATION: '${deal.category}' is not an authorized category. Approved categories: [${mandate.allowedCategories.join(", ")}].`,
  });

  // 5. KEYWORD / CONTENT BLACKLIST CHECK
  const textToScan = `${deal.productName} ${deal.category} ${deal.sellerName} ${deal.buyerIntent}`.toLowerCase();
  const matchedForbiddenWords = mandate.blockedKeywords.filter((keyword) =>
    textToScan.includes(keyword.toLowerCase().trim())
  );
  const blacklistPassed = matchedForbiddenWords.length === 0;
  checks.push({
    id: "RULE_FORBIDDEN_KEYWORDS",
    name: "Risk & Policy Blacklist",
    rule: "Item and merchant metadata must not contain blacklisted keywords",
    passed: blacklistPassed,
    severity: "blocker",
    details: blacklistPassed
      ? "No restricted or high-risk keywords detected in proposal metadata."
      : `VIOLATION: Found prohibited keyword(s): [${matchedForbiddenWords.join(", ")}].`,
  });

  // 6. NUMERIC INTEGRITY / TAMPER CHECK
  const integrityPassed =
    typeof deal.agreedPrice === "number" &&
    !isNaN(deal.agreedPrice) &&
    deal.agreedPrice > 0 &&
    deal.agreedPrice <= deal.listPrice * 1.5;
  checks.push({
    id: "RULE_NUMERIC_INTEGRITY",
    name: "Pricing Integrity & Anti-Tamper",
    rule: "Price must be positive, finite, and consistent with reasonable negotiation bounds",
    passed: integrityPassed,
    severity: "blocker",
    details: integrityPassed
      ? `Price verified as valid numerical value ($${deal.agreedPrice.toFixed(2)}).`
      : `VIOLATION: Invalid or spoofed price structure detected (${deal.agreedPrice}).`,
  });

  // 7. HUMAN APPROVAL THRESHOLD CHECK (FLAG / ROUTER)
  const isWithinAutonomousThreshold =
    deal.agreedPrice <= mandate.approvalThreshold;
  checks.push({
    id: "RULE_APPROVAL_THRESHOLD",
    name: "Autonomous Approval Threshold",
    rule: `Transactions above $${mandate.approvalThreshold.toFixed(2)} require explicit user confirmation`,
    passed: isWithinAutonomousThreshold,
    severity: "flag",
    details: isWithinAutonomousThreshold
      ? `Price $${deal.agreedPrice.toFixed(2)} is under the autonomous threshold ($${mandate.approvalThreshold.toFixed(2)}). Eligible for automatic checkout.`
      : `Price $${deal.agreedPrice.toFixed(2)} exceeds autonomous threshold ($${mandate.approvalThreshold.toFixed(2)}). User confirmation required before payment.`,
  });

  // DETERMINE FINAL DECISION
  const blockerChecks = checks.filter((c) => c.severity === "blocker");
  const failedBlockers = blockerChecks.filter((c) => !c.passed);
  const passedAllBlockers = failedBlockers.length === 0;

  let decision: GuardrailEvaluation["decision"];
  let reason: string;

  if (!passedAllBlockers) {
    decision = "REJECTED";
    reason = `Guardrail blocked deal: ${failedBlockers.map((b) => b.details).join(" | ")}`;
  } else if (!isWithinAutonomousThreshold) {
    decision = "NEEDS_HUMAN_APPROVAL";
    reason = `Guardrails passed, but price ($${deal.agreedPrice.toFixed(2)}) exceeds autonomous threshold ($${mandate.approvalThreshold.toFixed(2)}). Pending user authorization.`;
  } else {
    decision = "AUTO_APPROVED";
    reason = `All guardrails verified. Price ($${deal.agreedPrice.toFixed(2)}) is within autonomous threshold ($${mandate.approvalThreshold.toFixed(2)}). Auto-authorized for PayPal checkout.`;
  }

  return {
    dealId: deal.id,
    decision,
    passedAllBlockers,
    reason,
    checks,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: "DETERMINISTIC_ENGINE",
  };
}
