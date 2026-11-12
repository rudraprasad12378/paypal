export type ProductCategory =
  | "Electronics"
  | "Office & Desk"
  | "Peripherals"
  | "Software & Tools"
  | "Accessories"
  | "Prohibited";

export interface Mandate {
  totalBudget: number;         // Total authorized wallet budget (e.g. $100.00)
  remainingBudget: number;     // Remaining available budget
  spentAmount: number;         // Amount spent so far
  maxItemPrice: number;        // Maximum allowed price for any single item (e.g. $45.00)
  approvalThreshold: number;   // Deals > this price require explicit human approval (e.g. $30.00)
  allowedCategories: string[]; // List of permitted product categories
  blockedKeywords: string[];   // Blacklist of forbidden keywords / items
  killSwitchActive: boolean;   // Immediate global kill switch
  currency: string;            // Standard currency (USD)
  updatedAt: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  category: ProductCategory | string;
  listPrice: number;
  minReservePrice: number;     // Seller's absolute bottom line
  description: string;
  sellerName: string;
  sellerStyle: "cooperative" | "tough" | "fair";
  imageEmoji: string;
}

export interface NegotiationTurn {
  turn: number;
  speaker: "buyer" | "seller";
  speakerName: string;
  message: string;
  proposedPrice?: number;
  thought?: string;            // Internal agent reasoning
  timestamp: string;
}

export interface DealProposal {
  id: string;
  productId: string;
  productName: string;
  category: string;
  listPrice: number;
  agreedPrice: number;
  savings: number;
  sellerName: string;
  buyerIntent: string;
  turns: NegotiationTurn[];
  agreed: boolean;
  createdAt: string;
}

export interface GuardrailCheck {
  id: string;
  name: string;
  rule: string;
  passed: boolean;
  severity: "blocker" | "flag" | "info";
  details: string;
}

export type GuardrailDecision =
  | "AUTO_APPROVED"
  | "NEEDS_HUMAN_APPROVAL"
  | "REJECTED";

export interface GuardrailEvaluation {
  dealId: string;
  decision: GuardrailDecision;
  passedAllBlockers: boolean;
  reason: string;
  checks: GuardrailCheck[];
  evaluatedAt: string;
  evaluatedBy: "DETERMINISTIC_ENGINE"; // Proves it's code, not LLM
}

export type TransactionStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED_GUARDRAIL"
  | "REJECTED_HUMAN"
  | "PAYMENT_PROCESSING"
  | "PAYPAL_CAPTURED"
  | "PAYMENT_FAILED";

export interface Transaction {
  id: string;
  dealId: string;
  productId: string;
  productName: string;
  category: string;
  sellerName: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  guardrailResult: GuardrailEvaluation;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paymentMode: "LIVE_SANDBOX" | "SIMULATED_SANDBOX";
  createdAt: string;
  updatedAt: string;
}

export type AuditEventType =
  | "MANDATE_INIT"
  | "MANDATE_UPDATED"
  | "KILL_SWITCH_ENGAGED"
  | "KILL_SWITCH_RELEASED"
  | "NEGOTIATION_STARTED"
  | "NEGOTIATION_CONCLUDED"
  | "GUARDRAILS_EVALUATED"
  | "HUMAN_APPROVED"
  | "HUMAN_REJECTED"
  | "PAYPAL_ORDER_CREATED"
  | "PAYPAL_PAYMENT_CAPTURED"
  | "PAYPAL_PAYMENT_FAILED"
  | "SYSTEM_RESET";

export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  level: "info" | "warning" | "success" | "danger";
  title: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface AppState {
  mandate: Mandate;
  transactions: Transaction[];
  auditLogs: AuditLog[];
  products: CatalogProduct[];
}
