"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { MandateBar } from "@/components/MandateBar";
import { EditMandateModal } from "@/components/EditMandateModal";
import { CatalogSection } from "@/components/CatalogSection";
import { NegotiationArena } from "@/components/NegotiationArena";
import { GuardrailInspector } from "@/components/GuardrailInspector";
import { PayPalWalletCard } from "@/components/PayPalWalletCard";
import { TransactionHistory } from "@/components/TransactionHistory";
import { AuditLedger } from "@/components/AuditLedger";
import { ShieldCheck, ShieldAlert, Zap, Skull } from "lucide-react";
import {
  AppState,
  CatalogProduct,
  DealProposal,
  GuardrailEvaluation,
  Mandate,
  NegotiationTurn,
  Transaction,
} from "@/types";

interface EnvConfig {
  hasGeminiKey: boolean;
  geminiModel: string;
  hasPayPalKeys: boolean;
  paypalEnv: string;
  paypalMode: "LIVE_SANDBOX" | "SIMULATED_SANDBOX";
}

export default function Home() {
  const [state, setState] = useState<AppState | null>(null);
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Mode and Security Controls
  const [mode, setMode] = useState<"guarded" | "unguarded">("guarded");
  const [attackMode, setAttackMode] = useState(false);

  // Active negotiation & inspection state
  const [activeDeal, setActiveDeal] = useState<DealProposal | null>(null);
  const [activeGuardrail, setActiveGuardrail] = useState<GuardrailEvaluation | null>(null);
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);
  const [activeProductTitle, setActiveProductTitle] = useState<string>("");

  // Loading states
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isTogglingKillSwitch, setIsTogglingKillSwitch] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch initial or refreshed application state
  const refreshState = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setState({
          mandate: data.mandate,
          transactions: data.transactions,
          auditLogs: data.auditLogs,
          products: data.products,
        });
        setEnvConfig(data.envConfig);
      }
    } catch (err) {
      console.error("Failed to load state:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Toggle Emergency Kill Switch
  const handleToggleKillSwitch = async () => {
    if (!state) return;
    setIsTogglingKillSwitch(true);
    const nextState = !state.mandate.killSwitchActive;

    try {
      const res = await fetch("/api/killswitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextState }),
      });

      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error("Kill switch error:", err);
    } finally {
      setIsTogglingKillSwitch(false);
    }
  };

  // Reset Demo State
  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (res.ok) {
        setActiveDeal(null);
        setActiveGuardrail(null);
        setActiveTransaction(null);
        setActiveProductTitle("");
        await refreshState();
      }
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setIsResetting(false);
    }
  };

  // Save Mandate Updates
  const handleSaveMandate = async (updates: Partial<Mandate>) => {
    try {
      const res = await fetch("/api/mandate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await refreshState();
      }
    } catch (err) {
      console.error("Failed to update mandate:", err);
    }
  };

  // Process SSE Streaming Negotiation
  const processStreamingNegotiation = async (
    res: Response,
    product: {
      id: string;
      name: string;
      category: string;
      listPrice: number;
      sellerName?: string;
    }
  ) => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const liveTurns: NegotiationTurn[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        if (chunk.startsWith("data: ")) {
          const jsonStr = chunk.replace(/^data:\s*/, "").trim();
          try {
            const evt = JSON.parse(jsonStr);

            if (evt.type === "message") {
              liveTurns.push({
                turn: evt.round,
                speaker: evt.speaker,
                speakerName:
                  evt.speaker === "buyer"
                    ? "Mandate Buyer AI"
                    : product.sellerName || "Direct Merchant",
                message: evt.message,
                proposedPrice: evt.price,
                thought: evt.coached
                  ? "Guardrail feedback incorporated into adjusted proposal."
                  : undefined,
                timestamp: new Date().toISOString(),
              });

              setActiveDeal({
                id: `deal-${Date.now()}`,
                productId: product.id,
                productName: product.name,
                category: product.category,
                listPrice: product.listPrice,
                agreedPrice: evt.price,
                savings: Math.max(0, Number((product.listPrice - evt.price).toFixed(2))),
                sellerName: product.sellerName || "Direct Merchant",
                buyerIntent: `Procure ${product.name}`,
                turns: [...liveTurns],
                agreed: Boolean(evt.isDeal),
                createdAt: new Date().toISOString(),
              });
            } else if (evt.type === "complete") {
              const resData = evt.result;
              const decision =
                resData.status === "approved"
                  ? "AUTO_APPROVED"
                  : resData.status === "needs_approval"
                  ? "NEEDS_HUMAN_APPROVAL"
                  : "REJECTED";

              setActiveGuardrail({
                dealId: `deal-${Date.now()}`,
                decision,
                passedAllBlockers: resData.status !== "blocked",
                reason: resData.reasons.join(" "),
                checks: [
                  {
                    id: "GUARDRAIL_POLICY",
                    name: "Mandate Policy Audit",
                    rule: "Verify budget, item ceiling, and approval threshold",
                    passed: resData.status !== "blocked",
                    severity: "blocker",
                    details: resData.reasons.join(" "),
                  },
                ],
                evaluatedAt: new Date().toISOString(),
                evaluatedBy: "DETERMINISTIC_ENGINE",
              });

              if (resData.transactionId) {
                const refreshedTx: Transaction = {
                  id: resData.transactionId,
                  dealId: `deal-${Date.now()}`,
                  productId: product.id,
                  productName: product.name,
                  category: product.category,
                  sellerName: product.sellerName || "Direct Merchant",
                  amount: resData.finalPrice,
                  currency: "USD",
                  status:
                    resData.status === "approved"
                      ? "PAYPAL_CAPTURED"
                      : resData.status === "needs_approval"
                      ? "PENDING_APPROVAL"
                      : "REJECTED_GUARDRAIL",
                  paymentMode: "SIMULATED_SANDBOX",
                  guardrailResult: {
                    dealId: `deal-${Date.now()}`,
                    decision,
                    passedAllBlockers: resData.status !== "blocked",
                    reason: resData.reasons.join(" "),
                    checks: [],
                    evaluatedAt: new Date().toISOString(),
                    evaluatedBy: "DETERMINISTIC_ENGINE",
                  },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                setActiveTransaction(refreshedTx);
              }

              await refreshState();
            }
          } catch (err) {
            console.error("Failed to parse SSE event:", err);
          }
        }
      }
    }
  };

  // Start Negotiation with Product
  const handleSelectProduct = async (product: CatalogProduct, userGoal?: string) => {
    setIsNegotiating(true);
    setActiveProductTitle(product.name);
    setActiveDeal(null);
    setActiveGuardrail(null);
    setActiveTransaction(null);

    try {
      const res = await fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          userRequest: userGoal,
          mode,
          attackMode,
        }),
      });

      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        await processStreamingNegotiation(res, product);
      } else {
        const data = await res.json();
        if (data.success) {
          setActiveDeal(data.deal);
          setActiveGuardrail(data.guardrailResult);
          setActiveTransaction(data.transaction);
        }
        await refreshState();
      }
    } catch (err) {
      console.error("Negotiation failed:", err);
    } finally {
      setIsNegotiating(false);
    }
  };

  // Custom Shopping Prompt
  const handleCustomNegotiate = async (customProduct: {
    name: string;
    category: string;
    listPrice: number;
    minReservePrice: number;
    sellerName: string;
    description: string;
  }) => {
    setIsNegotiating(true);
    setActiveProductTitle(customProduct.name);
    setActiveDeal(null);
    setActiveGuardrail(null);
    setActiveTransaction(null);

    try {
      const res = await fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: customProduct.name,
          category: customProduct.category,
          listPrice: customProduct.listPrice,
          minPrice: customProduct.minReservePrice,
          userRequest: `Purchase ${customProduct.name}`,
          mode,
          attackMode,
        }),
      });

      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        await processStreamingNegotiation(res, {
          id: `custom-${Date.now()}`,
          name: customProduct.name,
          category: customProduct.category,
          listPrice: customProduct.listPrice,
          sellerName: customProduct.sellerName,
        });
      }
      await refreshState();
    } catch (err) {
      console.error("Custom negotiation failed:", err);
    } finally {
      setIsNegotiating(false);
    }
  };

  // Approve Deal (Human in the Loop - Captures Order via PayPal Orders API v2)
  const handleApproveDeal = async (txId: string) => {
    setIsProcessingAction(true);
    try {
      // 1. Create order via server-side verified create-order API
      const createRes = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txId,
          userApproved: true,
        }),
      });

      const createData = await createRes.json();
      if (!createData.success) {
        alert(createData.error || "Failed to create PayPal order");
        return;
      }

      // 2. Capture payment via PayPal Orders API v2
      const captureRes = await fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: createData.orderId,
          transactionId: txId,
        }),
      });

      const captureData = await captureRes.json();
      if (captureData.success) {
        if (activeTransaction && activeTransaction.id === txId) {
          setActiveTransaction(captureData.transaction);
        }
        await refreshState();
      } else {
        alert(captureData.error || "Failed to capture PayPal transaction");
      }
    } catch (err) {
      console.error("Approval error:", err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Launch PayPal Checkout Redirect Flow
  const handleCheckoutPayPal = async (txId: string) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txId,
          userApproved: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        alert(data.error || "Failed to generate PayPal checkout session");
      }
    } catch (err) {
      console.error("PayPal checkout redirect error:", err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Reject Deal (Human in the Loop)
  const handleRejectDeal = async (txId: string) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txId,
          decision: "REJECT",
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (activeTransaction && activeTransaction.id === txId) {
          setActiveTransaction(data.transaction);
        }
        await refreshState();
      } else {
        alert(data.error || "Failed to reject transaction");
      }
    } catch (err) {
      console.error("Rejection error:", err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-4">
        <div className="h-12 w-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin mb-4" />
        <h2 className="text-base font-bold text-white">Loading Mandate AI Wallet...</h2>
        <p className="text-xs text-slate-400 mt-1">Connecting to PayPal Sandbox &amp; Guardrail Engine</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Sticky Header */}
      <Header
        mandate={state.mandate}
        onToggleKillSwitch={handleToggleKillSwitch}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
        isTogglingKillSwitch={isTogglingKillSwitch}
        paymentMode={envConfig?.paypalMode}
        hasGeminiKey={envConfig?.hasGeminiKey}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Mandate & Budget Status Meter */}
        <MandateBar
          mandate={state.mandate}
          onOpenEditModal={() => setIsEditModalOpen(true)}
        />

        {/* Experimentation Bar: Guarded vs Unguarded & Attack Mode Simulation */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
              Safety Mode:
            </span>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setMode("guarded")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  mode === "guarded"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Guarded (Deterministic Safe)</span>
              </button>

              <button
                onClick={() => setMode("unguarded")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  mode === "unguarded"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Unguarded (Dumb Agent Comparison)</span>
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={attackMode}
              onChange={(e) => setAttackMode(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500 h-4 w-4"
            />
            <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
              <Skull className="h-3.5 w-3.5" />
              Simulate Seller Price Attack
            </span>
          </label>
        </div>

        {/* 3-Column Core Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Catalog & 1-Click Demo Scenarios (4 Cols) */}
          <div className="lg:col-span-4">
            <CatalogSection
              products={state.products}
              isNegotiating={isNegotiating}
              onSelectProduct={handleSelectProduct}
              onCustomNegotiate={handleCustomNegotiate}
            />
          </div>

          {/* MIDDLE: Agent Negotiation Arena & Guardrail Inspector (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <NegotiationArena
              deal={activeDeal}
              isNegotiating={isNegotiating}
              activeProductTitle={activeProductTitle}
            />

            <GuardrailInspector
              guardrailResult={activeGuardrail}
              transaction={activeTransaction}
              onApprove={handleApproveDeal}
              onReject={handleRejectDeal}
              isProcessingAction={isProcessingAction}
            />
          </div>

          {/* RIGHT: PayPal Sandbox Wallet, Transactions & Audit Ledger (3 Cols) */}
          <div className="lg:col-span-3 space-y-6">
            <PayPalWalletCard
              paymentMode={envConfig?.paypalMode || "SIMULATED_SANDBOX"}
              hasPayPalKeys={Boolean(envConfig?.hasPayPalKeys)}
              transactions={state.transactions}
              remainingBudget={state.mandate.remainingBudget}
            />

            <TransactionHistory
              transactions={state.transactions}
              onApprovePending={handleApproveDeal}
              onRejectPending={handleRejectDeal}
              onCheckoutPayPal={handleCheckoutPayPal}
              isProcessingAction={isProcessingAction}
            />

            <AuditLedger logs={state.auditLogs} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong>Mandate</strong> — Built for the PayPal AI Hackathon
          </span>
          <span>
            PayPal Orders API v2 (Sandbox) • Deterministic Code Guardrails • Free-Tier Architecture
          </span>
        </div>
      </footer>

      {/* Edit Mandate Modal */}
      {isEditModalOpen && (
        <EditMandateModal
          mandate={state.mandate}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveMandate}
        />
      )}
    </div>
  );
}
