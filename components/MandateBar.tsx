"use client";

import React from "react";
import { Sliders, ShieldCheck, Tag, DollarSign, AlertCircle } from "lucide-react";
import { Mandate } from "@/types";

interface MandateBarProps {
  mandate: Mandate | null;
  onOpenEditModal: () => void;
}

export function MandateBar({ mandate, onOpenEditModal }: MandateBarProps) {
  if (!mandate) return null;

  const budgetPct = Math.max(
    0,
    Math.min(100, (mandate.remainingBudget / mandate.totalBudget) * 100)
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Budget Meter */}
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
              <DollarSign className="h-3.5 w-3.5 text-blue-400" />
              Autonomous Spending Mandate
            </span>
            <span className="text-xs font-mono font-medium text-slate-300">
              Remaining: <strong className="text-emerald-400">${mandate.remainingBudget.toFixed(2)}</strong> / ${mandate.totalBudget.toFixed(2)}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budgetPct > 50
                  ? "bg-gradient-to-r from-blue-500 to-emerald-400"
                  : budgetPct > 20
                  ? "bg-gradient-to-r from-blue-500 to-amber-400"
                  : "bg-gradient-to-r from-amber-500 to-red-500"
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
            <span>Spent: ${mandate.spentAmount.toFixed(2)}</span>
            <span>{budgetPct.toFixed(0)}% budget available</span>
          </div>
        </div>

        {/* Center: Rules Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Auto-Approve Threshold
            </div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1">
              ≤ ${mandate.approvalThreshold.toFixed(2)}
              <span className="text-[10px] font-normal text-slate-400">(Deals &gt; this need human OK)</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Single-Item Max Cap
            </div>
            <div className="text-sm font-bold text-blue-400">
              ${mandate.maxItemPrice.toFixed(2)}
            </div>
          </div>

          {/* Edit Mandate Trigger */}
          <button
            onClick={onOpenEditModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:border-blue-500 transition"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Configure Mandate</span>
          </button>
        </div>
      </div>

      {/* Categories & Policies Bar */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <Tag className="h-3 w-3 text-slate-400" />
            Approved Categories:
          </span>
          {mandate.allowedCategories.map((cat) => (
            <span
              key={cat}
              className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/50"
            >
              {cat}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-red-400/80" />
            Blocked Keywords:
          </span>
          {mandate.blockedKeywords.slice(0, 4).map((word) => (
            <span
              key={word}
              className="px-1.5 py-0.5 rounded bg-red-950/40 text-red-300 text-[10px] border border-red-900/40"
            >
              {word}
            </span>
          ))}
          {mandate.blockedKeywords.length > 4 && (
            <span className="text-[10px] text-slate-400">
              +{mandate.blockedKeywords.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
