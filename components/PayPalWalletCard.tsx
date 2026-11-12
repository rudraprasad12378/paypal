"use client";

import React, { useState } from "react";
import { CreditCard, ExternalLink, Info, CheckCircle2, ShieldCheck } from "lucide-react";
import { Transaction } from "@/types";

interface PayPalWalletCardProps {
  paymentMode: string;
  hasPayPalKeys: boolean;
  transactions: Transaction[];
  remainingBudget: number;
}

export function PayPalWalletCard({
  paymentMode,
  hasPayPalKeys,
  transactions,
  remainingBudget,
}: PayPalWalletCardProps) {
  const [showDocs, setShowDocs] = useState(false);

  const capturedTransactions = transactions.filter(
    (t) => t.status === "PAYPAL_CAPTURED"
  );
  const totalSettled = capturedTransactions.reduce(
    (acc, curr) => acc + curr.amount,
    0
  );

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* Stylized PayPal P emblem */}
          <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-blue-600/30">
            P
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide">
              PayPal Sandbox Wallet
            </h3>
            <span className="text-[10px] text-blue-400 font-mono">
              Orders API v2
            </span>
          </div>
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            hasPayPalKeys
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
          }`}
        >
          {hasPayPalKeys ? "Live Sandbox v2" : "Sandbox Simulator"}
        </span>
      </div>

      {/* Balance & Stats Box */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Available Wallet Balance:</span>
          <span className="font-mono font-bold text-base text-emerald-400">
            ${remainingBudget.toFixed(2)} USD
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/60">
          <span className="text-slate-400">Total Settled via PayPal:</span>
          <span className="font-mono font-medium text-slate-200">
            ${totalSettled.toFixed(2)} ({capturedTransactions.length} items)
          </span>
        </div>
      </div>

      {/* Mode Note / Toggle Docs */}
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <button
          onClick={() => setShowDocs(!showDocs)}
          className="text-slate-400 hover:text-blue-300 flex items-center gap-1 transition"
        >
          <Info className="h-3 w-3 text-blue-400" />
          <span>{showDocs ? "Hide developer note" : "PayPal developer note"}</span>
        </button>

        <a
          href="https://developer.paypal.com/dashboard/applications/sandbox"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline flex items-center gap-1"
        >
          <span>Developer Dashboard</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {showDocs && (
        <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
          <div className="font-semibold text-white flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
            Hackathon Verification:
          </div>
          <p className="text-slate-400">
            Mandate communicates strictly with <code className="text-blue-300">https://api-m.sandbox.paypal.com</code>.
          </p>
          <p className="text-slate-400">
            To connect live developer sandbox credentials, add <code className="text-blue-300">PAYPAL_CLIENT_ID</code> and <code className="text-blue-300">PAYPAL_CLIENT_SECRET</code> into <code className="text-white">.env.local</code>.
          </p>
        </div>
      )}
    </div>
  );
}
