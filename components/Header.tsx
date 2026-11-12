"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, Power, RotateCcw, Sparkles, BarChart3 } from "lucide-react";
import { Mandate } from "@/types";

interface HeaderProps {
  mandate: Mandate | null;
  onToggleKillSwitch: () => void;
  onResetDemo: () => void;
  isResetting: boolean;
  isTogglingKillSwitch: boolean;
  paymentMode?: string;
  hasGeminiKey?: boolean;
}

export function Header({
  mandate,
  onToggleKillSwitch,
  onResetDemo,
  isResetting,
  isTogglingKillSwitch,
  paymentMode = "SIMULATED_SANDBOX",
  hasGeminiKey = false,
}: HeaderProps) {
  const isKillSwitchActive = mandate?.killSwitchActive ?? false;

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Project Info */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-blue-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                MANDATE
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  AI Wallet
                </span>
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PayPal AI Hackathon
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Safe AI Shopping Agent • Deterministic Guardrails • PayPal Sandbox v2
            </p>
          </div>
        </div>

        {/* Integration Status Badges */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
            <span
              className={`h-2 w-2 rounded-full ${
                paymentMode === "LIVE_SANDBOX" ? "bg-emerald-400" : "bg-blue-400"
              }`}
            />
            <span>
              PayPal:{" "}
              <strong className="text-white">
                {paymentMode === "LIVE_SANDBOX" ? "Live Sandbox" : "Sandbox Simulator"}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>
              LLM:{" "}
              <strong className="text-white">
                {hasGeminiKey ? "Gemini Free Tier" : "Deterministic Agent"}
              </strong>
            </span>
          </div>
        </div>

        {/* Actions: Navigation, Reset & Emergency Kill Switch */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-400 hover:text-white bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 transition shadow-sm"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>

          <button
            onClick={onResetDemo}
            disabled={isResetting}
            title="Reset demo state and balances"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`} />
            <span>Reset Demo</span>
          </button>

          {/* Big Emergency Kill Switch */}
          <button
            onClick={onToggleKillSwitch}
            disabled={isTogglingKillSwitch}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-lg ${
              isKillSwitchActive
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 animate-pulse border border-red-400"
                : "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 hover:border-emerald-500"
            }`}
          >
            <Power className="h-4 w-4" />
            <span>
              {isKillSwitchActive ? "KILL SWITCH: ENGAGED" : "KILL SWITCH: ARMED"}
            </span>
            <span
              className={`h-2 w-2 rounded-full ${
                isKillSwitchActive ? "bg-white" : "bg-emerald-400 animate-ping"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Kill Switch Active Warning Banner */}
      {isKillSwitchActive && (
        <div className="bg-red-950/90 border-t border-b border-red-600/50 px-4 py-2 text-center text-xs font-semibold text-red-200 flex items-center justify-center gap-2 animate-pulse">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          <span>
            EMERGENCY KILL SWITCH ENGAGED: ALL AI AGENT OPERATIONS, NEGOTIATIONS, AND PAYPAL CHECKOUTS ARE FROZEN.
          </span>
        </div>
      )}
    </header>
  );
}

