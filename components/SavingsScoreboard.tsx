"use client";

import React from "react";
import {
  ShieldCheck,
  TrendingUp,
  AlertOctagon,
  CreditCard,
  Lock,
  Sparkles,
} from "lucide-react";
import { AppState, Transaction, NegotiationRunRecord } from "@/types";

interface SavingsScoreboardProps {
  transactions: Transaction[];
  negotiationRuns?: NegotiationRunRecord[];
  remainingBudget: number;
  totalBudget: number;
}

export function SavingsScoreboard({
  transactions,
  negotiationRuns = [],
  remainingBudget,
  totalBudget,
}: SavingsScoreboardProps) {
  // 1. Calculate Total Savings achieved across guarded negotiations
  const runSavings = negotiationRuns.reduce(
    (sum, run) => sum + (run.savings > 0 ? run.savings : 0),
    0
  );

  // Prevention savings: When an attack (e.g. $500 prompt injection) or cap violation was blocked
  const attackPreventionSavings = negotiationRuns
    .filter((run) => run.attackMode && run.status === "blocked")
    .reduce((sum, run) => sum + Math.max(0, 500 - run.listPrice), 0);

  const totalSavings = Number((runSavings + attackPreventionSavings).toFixed(2));

  // 2. Count Blocked Risky Payments
  const blockedTxCount = transactions.filter(
    (t) => t.status === "REJECTED_GUARDRAIL" || t.status === "REJECTED_HUMAN"
  ).length;

  const blockedRunsCount = negotiationRuns.filter(
    (r) => r.status === "blocked"
  ).length;

  const totalBlocked = Math.max(blockedTxCount, blockedRunsCount);

  // 3. Total Captured / Safe Payments
  const capturedTx = transactions.filter((t) => t.status === "PAYPAL_CAPTURED");
  const totalSettled = capturedTx.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/60 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Scoreboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Live Mandate Protection Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Guardrails Saved You</span>
            <span className="text-emerald-400 font-mono">
              ${totalSavings > 0 ? totalSavings.toFixed(2) : "0.00"}
            </span>
            <span className="text-slate-400 font-normal text-sm sm:text-base">
              &amp; Blocked{" "}
              <strong className="text-rose-400 font-mono">{totalBlocked}</strong>{" "}
              Risky {totalBlocked === 1 ? "Payment" : "Payments"}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center gap-2 shadow-inner">
            <Lock className="h-3.5 w-3.5 text-blue-400" />
            <span>Deterministic Enforcement</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold">
              100% CODE
            </span>
          </div>
        </div>
      </div>

      {/* 4 Scoreboard Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-5">
        {/* Metric 1: Total Dollar Savings */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Savings Negotiated</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
            ${totalSavings.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Below list prices &amp; attacks neutralized
          </p>
        </div>

        {/* Metric 2: Risky Deals Blocked */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 transition hover:border-rose-500/40">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Risky Deals Blocked</span>
            <AlertOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-rose-400">
            {totalBlocked}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Caps, blacklist &amp; prompt overrides vetoed
          </p>
        </div>

        {/* Metric 3: Safe PayPal Settlements */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 transition hover:border-blue-500/40">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>PayPal Settled</span>
            <CreditCard className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white">
            ${totalSettled.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {capturedTx.length} authorized sandbox orders
          </p>
        </div>

        {/* Metric 4: Protected Wallet Balance */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 transition hover:border-indigo-500/40">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Budget Protected</span>
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-blue-300">
            ${remainingBudget.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            of ${totalBudget.toFixed(2)} total authorized
          </p>
        </div>
      </div>
    </div>
  );
}

