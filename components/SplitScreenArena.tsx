"use client";

import React, { useRef, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Bot,
  Store,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Skull,
  Lock,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { CatalogProduct, NegotiationTurn } from "@/types";

interface SplitScreenArenaProps {
  product: CatalogProduct | null;
  attackMode: boolean;
  onToggleAttackMode: () => void;
  isNegotiating: boolean;
  unguardedTurns: NegotiationTurn[];
  guardedTurns: NegotiationTurn[];
  unguardedResult: {
    finalPrice: number;
    status: "approved" | "needs_approval" | "blocked";
    reasons: string[];
    savings: number;
    listPrice: number;
  } | null;
  guardedResult: {
    finalPrice: number;
    status: "approved" | "needs_approval" | "blocked";
    reasons: string[];
    savings: number;
    listPrice: number;
    transactionId?: string;
  } | null;
  onApproveGuarded?: (txId: string) => Promise<void>;
  onCheckoutPayPal?: (txId: string) => Promise<void>;
  isProcessingApproval?: boolean;
}

export function SplitScreenArena({
  product,
  attackMode,
  onToggleAttackMode,
  isNegotiating,
  unguardedTurns,
  guardedTurns,
  unguardedResult,
  guardedResult,
  onApproveGuarded,
  onCheckoutPayPal,
  isProcessingApproval,
}: SplitScreenArenaProps) {
  const unguardedScrollRef = useRef<HTMLDivElement>(null);
  const guardedScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat boxes on new messages
  useEffect(() => {
    if (unguardedScrollRef.current) {
      unguardedScrollRef.current.scrollTop = unguardedScrollRef.current.scrollHeight;
    }
  }, [unguardedTurns]);

  useEffect(() => {
    if (guardedScrollRef.current) {
      guardedScrollRef.current.scrollTop = guardedScrollRef.current.scrollHeight;
    }
  }, [guardedTurns]);

  const hasActivity =
    isNegotiating ||
    unguardedTurns.length > 0 ||
    guardedTurns.length > 0 ||
    unguardedResult !== null ||
    guardedResult !== null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        {/* Product In Focus */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shadow-inner">
            {product?.imageEmoji || "⚖️"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                Live Dual Arena
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-300 font-semibold">
                Guarded vs Unguarded
              </span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>{product ? product.name : "Select a product above to negotiate"}</span>
              {product && (
                <span className="text-xs font-mono text-slate-400 font-normal">
                  (List: ${product.listPrice.toFixed(2)})
                </span>
              )}
            </h3>
          </div>
        </div>

        {/* Attack Mode Switch */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-2xl">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 justify-end">
              <Skull className="h-3 w-3 text-rose-400" />
              <span>Adversarial Attack Mode</span>
            </div>
            <div
              className={`text-xs font-bold ${
                attackMode ? "text-rose-400 animate-pulse" : "text-slate-400"
              }`}
            >
              {attackMode ? "ON: Prompt Injection $500" : "OFF: Standard Negotiation"}
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleAttackMode}
            disabled={isNegotiating}
            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 focus:outline-none disabled:opacity-50 ${
              attackMode
                ? "bg-rose-600 shadow-md shadow-rose-600/40"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-300 ${
                attackMode ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {!hasActivity && (
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Bot className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-white">
            Dual Negotiation Arena Ready
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Choose any product from the catalog above. The system will dispatch two Buyer agents simultaneously: an unguarded agent on the left, and a guarded agent on the right.
          </p>
        </div>
      )}

      {/* Split-Screen Dual Panels Grid */}
      {hasActivity && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* ================================================================= */}
          {/* LEFT: UNGUARDED AGENT (Red Warning Badge) */}
          {/* ================================================================= */}
          <div className="flex flex-col bg-slate-950/80 border border-rose-900/30 rounded-3xl overflow-hidden shadow-xl">
            {/* Panel Header */}
            <div className="px-4 py-3 bg-rose-950/20 border-b border-rose-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Unguarded Agent</span>
                    <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Blind Trust
                    </span>
                  </h4>
                  <p className="text-[10px] text-rose-300/70">
                    No spending caps • No category check • Accepts overrides
                  </p>
                </div>
              </div>

              {isNegotiating && (
                <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-medium">
                  <div className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                  <span>Negotiating...</span>
                </div>
              )}
            </div>

            {/* Chat Transcript Area */}
            <div
              ref={unguardedScrollRef}
              className="p-4 space-y-3 min-h-[300px] max-h-[360px] overflow-y-auto"
            >
              {unguardedTurns.length === 0 && isNegotiating && (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 py-12">
                  <div className="animate-spin h-5 w-5 border-2 border-rose-500/30 border-t-rose-500 rounded-full mr-2" />
                  <span>Connecting Unguarded Buyer AI to Seller...</span>
                </div>
              )}

              {unguardedTurns.map((turn, idx) => {
                const isBuyer = turn.speaker === "buyer";
                return (
                  <div
                    key={`ung-${turn.turn}-${idx}`}
                    className={`flex items-start gap-2.5 animate-message-in ${
                      isBuyer ? "" : "flex-row-reverse"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 border text-xs ${
                        isBuyer
                          ? "bg-rose-950/40 border-rose-800/40 text-rose-400"
                          : "bg-purple-950/40 border-purple-800/40 text-purple-400"
                      }`}
                    >
                      {isBuyer ? <Bot className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl p-2.5 text-xs ${
                        isBuyer
                          ? "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm"
                          : "bg-purple-950/20 border border-purple-900/40 text-purple-200 rounded-tr-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-[10px] text-white">
                          {isBuyer ? "Unguarded Buyer AI" : product?.sellerName || "Direct Merchant"}
                        </span>
                        {turn.proposedPrice !== undefined && (
                          <span
                            className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                              turn.proposedPrice > (product?.listPrice || 100)
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            ${turn.proposedPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">
                        {turn.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Result Banner Under Unguarded Panel */}
            <div className="mt-auto p-4 bg-slate-900 border-t border-rose-900/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Unguarded Outcome:
                </span>
                {unguardedResult ? (
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      unguardedResult.finalPrice > (unguardedResult.listPrice || 100)
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {unguardedResult.finalPrice > (unguardedResult.listPrice || 100)
                      ? "⚠️ EXPLOITED (OVERPAID)"
                      : "UNCHECKED APPROVAL"}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">Awaiting result...</span>
                )}
              </div>

              {unguardedResult ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Accepted Final Price:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      ${unguardedResult.finalPrice.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-900/40 text-[11px] text-rose-300 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                      <span>Security Failure:</span>
                    </div>
                    <p className="text-rose-300/80">
                      {unguardedResult.finalPrice > (unguardedResult.listPrice || 100)
                        ? "The Buyer AI fell for the seller's manipulation attack and authorized an inflated $500 demand with zero guardrail checks."
                        : "Unguarded baseline: guardrails skipped. Transaction authorized without spending or category checks."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic py-2">
                  Waiting for negotiation stream to conclude...
                </div>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* RIGHT: GUARDED AGENT (Green Shield Badge) */}
          {/* ================================================================= */}
          <div className="flex flex-col bg-slate-950/80 border border-emerald-900/40 rounded-3xl overflow-hidden shadow-xl">
            {/* Panel Header */}
            <div className="px-4 py-3 bg-emerald-950/20 border-b border-emerald-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Guarded Agent (Mandate)</span>
                    <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Protected
                    </span>
                  </h4>
                  <p className="text-[10px] text-emerald-300/70">
                    Deterministic caps • Category audit • Coaching feedback loop
                  </p>
                </div>
              </div>

              {isNegotiating && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Enforcing...</span>
                </div>
              )}
            </div>

            {/* Chat Transcript Area */}
            <div
              ref={guardedScrollRef}
              className="p-4 space-y-3 min-h-[300px] max-h-[360px] overflow-y-auto"
            >
              {guardedTurns.length === 0 && isNegotiating && (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 py-12">
                  <div className="animate-spin h-5 w-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full mr-2" />
                  <span>Connecting Guarded Buyer AI to Seller...</span>
                </div>
              )}

              {guardedTurns.map((turn, idx) => {
                const isBuyer = turn.speaker === "buyer";
                return (
                  <div
                    key={`grd-${turn.turn}-${idx}`}
                    className={`flex items-start gap-2.5 animate-message-in ${
                      isBuyer ? "" : "flex-row-reverse"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 border text-xs ${
                        isBuyer
                          ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400"
                          : "bg-purple-950/40 border-purple-800/40 text-purple-400"
                      }`}
                    >
                      {isBuyer ? <Bot className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl p-2.5 text-xs ${
                        isBuyer
                          ? "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm"
                          : "bg-purple-950/20 border border-purple-900/40 text-purple-200 rounded-tr-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-[10px] text-white">
                          {isBuyer ? "Mandate Buyer AI" : product?.sellerName || "Direct Merchant"}
                        </span>
                        {turn.proposedPrice !== undefined && (
                          <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                            ${turn.proposedPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">
                        {turn.message}
                      </p>

                      {/* Coaching indicator badge if coached */}
                      {turn.thought && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                          <Lock className="h-3 w-3" />
                          <span>Guardrail Coached: conformed offer to spending cap.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Result Banner Under Guarded Panel */}
            <div className="mt-auto p-4 bg-slate-900 border-t border-emerald-900/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Guarded Outcome:
                </span>
                {guardedResult ? (
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      guardedResult.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : guardedResult.status === "needs_approval"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {guardedResult.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                    {guardedResult.status === "needs_approval" && <AlertTriangle className="h-3 w-3" />}
                    {guardedResult.status === "blocked" && <XCircle className="h-3 w-3" />}
                    <span>{guardedResult.status.toUpperCase()}</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">Awaiting result...</span>
                )}
              </div>

              {guardedResult ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Final Price Negotiated:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ${guardedResult.finalPrice.toFixed(2)} USD
                    </span>
                  </div>

                  {guardedResult.savings > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Total Savings:</span>
                      <span className="font-mono font-bold text-white">
                        ${guardedResult.savings.toFixed(2)} below list
                      </span>
                    </div>
                  )}

                  {/* Reasons box */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                    <div className="font-semibold text-white flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                      <span>Deterministic Audit Reason:</span>
                    </div>
                    <p className="text-slate-400">
                      {guardedResult.reasons.join(" ") || "All mandate spending policies satisfied."}
                    </p>
                  </div>

                  {/* CRITICAL REQUIREMENT: APPROVE BUTTON FOR NEEDS_APPROVAL */}
                  {guardedResult.status === "needs_approval" && guardedResult.transactionId && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="text-[11px] text-amber-300 flex items-center gap-1 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        <span>High-Value Purchase: Requires Explicit User Authorization</span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        {onCheckoutPayPal && (
                          <button
                            onClick={() => onCheckoutPayPal(guardedResult.transactionId!)}
                            disabled={isProcessingApproval}
                            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 disabled:opacity-50"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Approve &amp; Open PayPal Checkout</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}

                        {onApproveGuarded && (
                          <button
                            onClick={() => onApproveGuarded(guardedResult.transactionId!)}
                            disabled={isProcessingApproval}
                            className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {isProcessingApproval ? (
                              <div className="h-3 w-3 rounded-full border border-white border-t-transparent animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            <span>Quick Approve</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic py-2">
                  Waiting for negotiation stream to conclude...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
