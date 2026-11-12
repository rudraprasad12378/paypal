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
import {
  AppState,
  CatalogProduct,
  DealProposal,
  GuardrailEvaluation,
  Mandate,
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
          userGoal,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActiveDeal(data.deal);
        setActiveGuardrail(data.guardrailResult);
        setActiveTransaction(data.transaction);
        await refreshState();
      } else {
        alert(data.message || data.error || "Negotiation stopped");
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
          customProduct,
          userGoal: `Purchase ${customProduct.name}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActiveDeal(data.deal);
        setActiveGuardrail(data.guardrailResult);
        setActiveTransaction(data.transaction);
        await refreshState();
      } else {
        alert(data.message || data.error || "Negotiation stopped");
        await refreshState();
      }
    } catch (err) {
      console.error("Custom negotiation failed:", err);
    } finally {
      setIsNegotiating(false);
    }
  };

  // Approve Deal (Human in the Loop)
  const handleApproveDeal = async (txId: string) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txId,
          decision: "APPROVE",
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (activeTransaction && activeTransaction.id === txId) {
          setActiveTransaction(data.transaction);
        }
        await refreshState();
      } else {
        alert(data.error || "Failed to approve transaction");
      }
    } catch (err) {
      console.error("Approval error:", err);
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
