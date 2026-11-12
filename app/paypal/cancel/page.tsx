"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ShieldCheck, Ban } from "lucide-react";

function PayPalCancelContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const txId = searchParams.get("txId") || "";

  return (
    <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header Badge */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-lg">
            <Ban className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              PayPal Checkout Cancelled
            </h1>
            <p className="text-[11px] text-amber-400 font-mono">
              Transaction Voided
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          No Money Spent
        </span>
      </div>

      {/* Main Cancellation Message */}
      <div className="text-center space-y-2 py-4">
        <div className="h-14 w-14 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-white">
          Payment Process Terminated
        </h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          You opted to cancel the PayPal checkout session. No money was charged, and your wallet remains unchanged.
        </p>
      </div>

      {/* Order Context */}
      {(token || txId) && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs font-mono">
          {token && (
            <div className="flex justify-between items-center text-slate-400">
              <span>PayPal Token:</span>
              <span className="text-amber-400 truncate max-w-[220px]">
                {token}
              </span>
            </div>
          )}
          {txId && (
            <div className="flex justify-between items-center text-slate-400">
              <span>Mandate Tx ID:</span>
              <span className="text-slate-200 truncate max-w-[220px]">
                {txId}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Security & Mandate Guarantee */}
      <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-200">
        <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-white">Wallet Integrity Preserved</div>
          <p className="text-[11px] text-emerald-300/80">
            Mandate enforces zero-loss guarantees: uncaptured orders never deduct your budget or alter your mandate policy.
          </p>
        </div>
      </div>

      {/* Navigation Return */}
      <div className="pt-2">
        <Link
          href="/"
          className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition text-center flex items-center justify-center gap-2 border border-slate-700 shadow"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Mandate Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function PayPalCancelPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
            <p className="text-xs">Loading cancellation notice...</p>
          </div>
        }
      >
        <PayPalCancelContent />
      </Suspense>
    </div>
  );
}

