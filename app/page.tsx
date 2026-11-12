"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { SavingsScoreboard } from "@/components/SavingsScoreboard";
import { MandatePanel } from "@/components/MandatePanel";
import { ShoppingRequestBox } from "@/components/ShoppingRequestBox";
import { SplitScreenArena } from "@/components/SplitScreenArena";
import { PayPalWalletCard } from "@/components/PayPalWalletCard";
import { TransactionHistory } from "@/components/TransactionHistory";
import { AuditLedger } from "@/components/AuditLedger";
import {
  AppState,
  CatalogProduct,
  Mandate,
  NegotiationTurn,
  Transaction,
  NegotiationRunRecord,
} from "@/types";

interface EnvConfig {
  hasGeminiKey: boolean;
  geminiModel: string;
  hasPayPalKeys: boolean;
  paypalEnv: string;
  paypalMode: "LIVE_SANDBOX" | "SIMULATED_SANDBOX";
}

interface ResultData {
  finalPrice: number;
  status: "approved" | "needs_approval" | "blocked";
  reasons: string[];
  savings: number;
  listPrice: number;
  transactionId?: string;
}

export default function Home() {
  const [state, setState] = useState<AppState | null>(null);
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Attack Mode Toggle
  const [attackMode, setAttackMode] = useState(false);

  // Active Selected Product for Dual Arena
  const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);

  // Dual Negotiation Transcript State
  const [unguardedTurns, setUnguardedTurns] = useState<NegotiationTurn[]>([]);
  const [guardedTurns, setGuardedTurns] = useState<NegotiationTurn[]>([]);
  const [unguardedResult, setUnguardedResult] = useState<ResultData | null>(null);
  const [guardedResult, setGuardedResult] = useState<ResultData | null>(null);

  // Async Action States
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isTogglingKillSwitch, setIsTogglingKillSwitch] = useState(false);

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
          negotiationRuns: data.negotiationRuns || [],
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

  // Set default product on load
  useEffect(() => {
    if (state?.products && state.products.length > 0 && !activeProduct) {
      setActiveProduct(state.products[0]);
    }
  }, [state?.products, activeProduct]);

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
        setUnguardedTurns([]);
        setGuardedTurns([]);
        setUnguardedResult(null);
        setGuardedResult(null);
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

  // Stream Reader Helper for Dual Negotiation
  const readSSEStream = async (
    res: Response,
    targetSide: "unguarded" | "guarded",
    product: CatalogProduct
  ) => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const turnsAccumulator: NegotiationTurn[] = [];

    try {
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
                const turnItem: NegotiationTurn = {
                  turn: evt.round,
                  speaker: evt.speaker,
                  speakerName:
                    evt.speaker === "buyer"
                      ? targetSide === "guarded"
                        ? "Mandate Buyer AI"
                        : "Unguarded Buyer AI"
                      : product.sellerName || "Direct Merchant",
                  message: evt.message,
                  proposedPrice: evt.price,
                  thought: evt.coached
                    ? "Guardrail Coach: adjust proposal to comply with spending cap."
                    : undefined,
                  timestamp: new Date().toISOString(),
                };

                turnsAccumulator.push(turnItem);

                if (targetSide === "unguarded") {
                  setUnguardedTurns([...turnsAccumulator]);
                } else {
                  setGuardedTurns([...turnsAccumulator]);
                }
              } else if (evt.type === "complete") {
                const resData = evt.result;
                const resultObj: ResultData = {
                  finalPrice: resData.finalPrice,
                  status: resData.status,
                  reasons: resData.reasons || [],
                  savings: resData.savings || 0,
                  listPrice: resData.listPrice,
                  transactionId: resData.transactionId,
                };

                if (targetSide === "unguarded") {
                  setUnguardedResult(resultObj);
                } else {
                  setGuardedResult(resultObj);
                }
              }
            } catch (err) {
              console.error("SSE parse error:", err);
            }
          }
        }
      }
    } catch (streamErr) {
      console.error(`Stream error on ${targetSide}:`, streamErr);
    }
  };

  // Launch Dual Negotiation: Simultaneously runs Guarded and Unguarded agents
  const runDualNegotiation = async (product: CatalogProduct, userGoal?: string) => {
    setIsNegotiating(true);
    setActiveProduct(product);
    setUnguardedTurns([]);
    setGuardedTurns([]);
    setUnguardedResult(null);
    setGuardedResult(null);

    const goal = userGoal || `Purchase ${product.name} at best available price`;

    try {
      // 1. Kick off Unguarded Negotiation Stream (Left Panel)
      const unguardedPromise = fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          category: product.category,
          listPrice: product.listPrice,
          minPrice: product.minPrice || product.minReservePrice,
          userRequest: goal,
          mode: "unguarded",
          attackMode,
        }),
      }).then((res) => readSSEStream(res, "unguarded", product));

      // 2. Kick off Guarded Negotiation Stream (Right Panel)
      const guardedPromise = fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          category: product.category,
          listPrice: product.listPrice,
          minPrice: product.minPrice || product.minReservePrice,
          userRequest: goal,
          mode: "guarded",
          attackMode,
        }),
      }).then((res) => readSSEStream(res, "guarded", product));

      // Wait for both concurrent streams
      await Promise.all([unguardedPromise, guardedPromise]);
      await refreshState();
    } catch (err) {
      console.error("Dual negotiation execution error:", err);
    } finally {
      setIsNegotiating(false);
    }
  };

  // Select Product from Shopping Request Box
  const handleSelectProduct = (product: CatalogProduct, userGoal?: string) => {
    runDualNegotiation(product, userGoal);
  };

  // Custom Shopping Prompt Negotiate
  const handleCustomNegotiate = (customProduct: {
    name: string;
    category: string;
    listPrice: number;
    minReservePrice: number;
    sellerName: string;
    description: string;
  }) => {
    const customItem: CatalogProduct = {
      id: `custom-${Date.now()}`,
      name: customProduct.name,
      category: customProduct.category,
      listPrice: customProduct.listPrice,
      minReservePrice: customProduct.minReservePrice,
      minPrice: customProduct.minReservePrice,
      description: customProduct.description,
      sellerName: customProduct.sellerName,
      sellerStyle: "fair",
      imageEmoji: "📦",
    };

    runDualNegotiation(customItem, `Purchase ${customProduct.name}`);
  };

  // Approve Deal (Human in the Loop - Captures Order via PayPal Orders API v2)
  const handleApproveDeal = async (txId: string) => {
    setIsProcessingAction(true);
    try {
      // 1. Create order via server-verified route
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
        // Update guarded result banner
        if (guardedResult) {
          setGuardedResult({
            ...guardedResult,
            status: "approved",
            reasons: ["User explicitly approved high-value purchase. Payment captured on PayPal Sandbox."],
          });
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

  // Reject Deal
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
        if (guardedResult) {
          setGuardedResult({
            ...guardedResult,
            status: "blocked",
            reasons: ["User explicitly vetoed high-value purchase."],
          });
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
      {/* Sticky Header with Brand, Integration Badges & Global Kill Switch */}
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
        {/* 1. SAVINGS SCOREBOARD BANNER */}
        <SavingsScoreboard
          transactions={state.transactions}
          negotiationRuns={state.negotiationRuns}
          remainingBudget={state.mandate.remainingBudget}
          totalBudget={state.mandate.totalBudget}
        />

        {/* 2. MANDATE PANEL (Daily budget, Cap, Threshold, Category chips & Big Red Kill Switch) */}
        <MandatePanel
          mandate={state.mandate}
          onUpdateMandate={handleSaveMandate}
          onToggleKillSwitch={handleToggleKillSwitch}
          isTogglingKillSwitch={isTogglingKillSwitch}
        />

        {/* 3. SHOPPING REQUEST BOX (Natural language query + Catalog matches) */}
        <ShoppingRequestBox
          products={state.products}
          mandate={state.mandate}
          onSelectProduct={handleSelectProduct}
          onCustomNegotiate={handleCustomNegotiate}
          isNegotiating={isNegotiating}
          activeProductId={activeProduct?.id}
        />

        {/* 4. SPLIT-SCREEN "GUARDED VS UNGUARDED" VIEW (Side by side with Attack Mode & Approve button) */}
        <SplitScreenArena
          product={activeProduct}
          attackMode={attackMode}
          onToggleAttackMode={() => setAttackMode((prev) => !prev)}
          isNegotiating={isNegotiating}
          unguardedTurns={unguardedTurns}
          guardedTurns={guardedTurns}
          unguardedResult={unguardedResult}
          guardedResult={guardedResult}
          onApproveGuarded={handleApproveDeal}
          onCheckoutPayPal={handleCheckoutPayPal}
          isProcessingApproval={isProcessingAction}
        />

        {/* 5. LEDGER & PAYPAL WALLET SECTION (3 Columns Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PayPal Sandbox Wallet Card */}
          <div className="lg:col-span-1">
            <PayPalWalletCard
              paymentMode={envConfig?.paypalMode || "SIMULATED_SANDBOX"}
              hasPayPalKeys={Boolean(envConfig?.hasPayPalKeys)}
              transactions={state.transactions}
              remainingBudget={state.mandate.remainingBudget}
            />
          </div>

          {/* Transaction History & Order IDs */}
          <div className="lg:col-span-1">
            <TransactionHistory
              transactions={state.transactions}
              onApprovePending={handleApproveDeal}
              onRejectPending={handleRejectDeal}
              onCheckoutPayPal={handleCheckoutPayPal}
              isProcessingAction={isProcessingAction}
            />
          </div>

          {/* Immutable Audit Ledger */}
          <div className="lg:col-span-1">
            <AuditLedger logs={state.auditLogs} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong>Mandate</strong> — Safe AI Shopping Agent Wallet for the PayPal AI Hackathon
          </span>
          <span>
            PayPal Orders API v2 (Sandbox) • Deterministic Code Guardrails • Free-Tier Friendly
          </span>
        </div>
      </footer>
    </div>
  );
}
