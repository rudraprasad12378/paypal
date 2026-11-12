import { NextResponse } from "next/server";
import { evaluateDealGuardrails } from "@/lib/guardrails";
import { DEFAULT_MANDATE } from "@/lib/store";
import { DealProposal } from "@/types";

export async function GET() {
  const mandate = { ...DEFAULT_MANDATE };

  // Scenario 1: Safe deal under $30 -> AUTO_APPROVED
  const safeDeal: DealProposal = {
    id: "deal-test-1",
    productId: "prod-mouse-01",
    productName: "Ergonomic Vertical Mouse",
    category: "Peripherals",
    listPrice: 28.0,
    agreedPrice: 22.0,
    savings: 6.0,
    sellerName: "Apex Peripherals",
    buyerIntent: "Buy ergonomic mouse under $25",
    turns: [],
    agreed: true,
    createdAt: new Date().toISOString(),
  };

  // Scenario 2: Deal over $30 threshold but under $45 max -> NEEDS_HUMAN_APPROVAL
  const highValueDeal: DealProposal = {
    id: "deal-test-2",
    productId: "prod-keyboard-02",
    productName: "Compact Mechanical Keyboard",
    category: "Electronics",
    listPrice: 42.0,
    agreedPrice: 38.0,
    savings: 4.0,
    sellerName: "KeyCraft Labs",
    buyerIntent: "Buy mechanical keyboard",
    turns: [],
    agreed: true,
    createdAt: new Date().toISOString(),
  };

  // Scenario 3: Exceeds $45 per-item ceiling -> REJECTED
  const overItemLimitDeal: DealProposal = {
    id: "deal-test-3",
    productId: "prod-monitor-05",
    productName: "Ultrawide Display",
    category: "Electronics",
    listPrice: 189.0,
    agreedPrice: 135.0,
    savings: 54.0,
    sellerName: "UltraVision Tech",
    buyerIntent: "Buy ultrawide display",
    turns: [],
    agreed: true,
    createdAt: new Date().toISOString(),
  };

  // Scenario 4: Prohibited category / blacklist keyword -> REJECTED
  const prohibitedDeal: DealProposal = {
    id: "deal-test-4",
    productId: "prod-crypto-06",
    productName: "Crypto Mining Cloud Voucher",
    category: "Prohibited",
    listPrice: 40.0,
    agreedPrice: 25.0,
    savings: 15.0,
    sellerName: "ShadowChain Ltd",
    buyerIntent: "Buy crypto tokens",
    turns: [],
    agreed: true,
    createdAt: new Date().toISOString(),
  };

  // Scenario 5: Kill switch active -> REJECTED
  const killSwitchMandate = { ...mandate, killSwitchActive: true };
  const killSwitchResult = evaluateDealGuardrails(safeDeal, killSwitchMandate);

  const results = {
    scenario1_safe: evaluateDealGuardrails(safeDeal, mandate),
    scenario2_needsApproval: evaluateDealGuardrails(highValueDeal, mandate),
    scenario3_overItemLimit: evaluateDealGuardrails(overItemLimitDeal, mandate),
    scenario4_prohibited: evaluateDealGuardrails(prohibitedDeal, mandate),
    scenario5_killSwitch: killSwitchResult,
  };

  const allPassedExpectations =
    results.scenario1_safe.decision === "AUTO_APPROVED" &&
    results.scenario2_needsApproval.decision === "NEEDS_HUMAN_APPROVAL" &&
    results.scenario3_overItemLimit.decision === "REJECTED" &&
    results.scenario4_prohibited.decision === "REJECTED" &&
    results.scenario5_killSwitch.decision === "REJECTED";

  return NextResponse.json({
    status: allPassedExpectations ? "SUCCESS" : "FAILED",
    allPassedExpectations,
    results,
  });
}
