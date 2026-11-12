"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Receipt,
  ArrowLeft,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface CaptureState {
  loading: boolean;
  success: boolean;
  orderId?: string;
  captureId?: string;
  productName?: string;
  amount?: number;
  paymentMode?: string;
  remainingBudget?: number;
  error?: string;
}

function PayPalReturnContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const payerId = searchParams.get("PayerID") || "";
  const txId = searchParams.get("txId") || "";

  const [state, setState] = useState<CaptureState>({
    loading: true,
    success: false,
  });

  useEffect(() => {
    let isMounted = true;

    async function executeCapture() {
      if (!token) {
        setState({
          loading: false,
          success: false,
          error: "No PayPal Order token found in URL parameters.",
        });
        return;
      }

      try {
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: token,
            transactionId: txId,
          }),
        });

        const data = await res.json();

        if (isMounted) {
          if (res.ok && data.success) {
            setState({
              loading: false,
              success: true,
              orderId: data.orderId || token,
              captureId: data.captureId,
              productName: data.transaction?.productName || "Authorized Purchase",
              amount: data.transaction?.amount,
              paymentMode: data.paymentMode || "LIVE_SANDBOX",
              remainingBudget: data.remainingBudget,
            });
          } else {
            setState({
              loading: false,
              success: false,
              orderId: token,
              error: data.error || "Failed to capture payment with PayPal.",
            });
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setState({
            loading: false,
            success: false,
            orderId: token,
            error:
              err instanceof Error
                ? err.message
                : "Network or server error during capture.",
          });
        }
      }
    }

    executeCapture();

    return () => {
      isMounted = false;
    };
  }, [token, txId]);

  return (
    <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header Badge */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-white text-lg shadow-md shadow-blue-600/30">
            P
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              PayPal Orders API v2
            </h1>
            <p className="text-[11px] text-blue-400 font-mono">
              Sandbox Checkout Return
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
          Sandbox Verification
        </span>
      </div>

      {/* Loading State */}
      {state.loading && (
        <div className="py-10 text-center space-y-4">
          <div className="h-12 w-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin mx-auto" />
          <h2 className="text-base font-bold text-white">
            Capturing PayPal Order...
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Contacting <code className="text-blue-300">api-m.sandbox.paypal.com</code> via{" "}
            <code className="text-blue-300">POST /v2/checkout/orders/{token || "..."}/capture</code>
          </p>
        </div>
      )}

      {/* Success State */}
      {!state.loading && state.success && (
        <div className="space-y-5">
          <div className="text-center space-y-2">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-white">
              Payment Successfully Captured!
            </h2>
            <p className="text-xs text-slate-400">
              Your deal was negotiated by AI, verified by deterministic guardrails, and settled via PayPal Sandbox.
            </p>
          </div>

          {/* Receipt Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-blue-400" />
                Product
              </span>
              <span className="font-semibold text-white truncate max-w-[200px]">
                {state.productName}
              </span>
            </div>

            {state.amount !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Amount Captured:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  ${state.amount.toFixed(2)} USD
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-slate-400">PayPal Order ID:</span>
              <span className="font-mono text-blue-400 text-[11px] truncate max-w-[220px]">
                {state.orderId}
              </span>
            </div>

            {state.captureId && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">PayPal Capture ID:</span>
                <span className="font-mono text-emerald-400 text-[11px] truncate max-w-[220px]">
                  {state.captureId}
                </span>
              </div>
            )}

            {payerId && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Payer ID:</span>
                <span className="font-mono text-slate-300 text-[11px]">
                  {payerId}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Settlement Mode:</span>
              <span className="font-mono text-slate-200 text-[11px]">
                {state.paymentMode}
              </span>
            </div>

            {state.remainingBudget !== undefined && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Remaining Wallet Budget:</span>
                <span className="font-mono font-bold text-slate-200">
                  ${state.remainingBudget.toFixed(2)} USD
                </span>
              </div>
            )}
          </div>

          {/* Guardrail Guarantee Banner */}
          <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-blue-200">
            <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Guardrail Verified: </span>
              Every penny of this transaction conformed to your spending mandate before PayPal settlement was triggered.
            </div>
          </div>
        </div>
      )}

      {/* Failure State */}
      {!state.loading && !state.success && (
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <div className="h-14 w-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-white">
              Payment Capture Failed
            </h2>
            <p className="text-xs text-rose-300/80 max-w-sm mx-auto">
              {state.error || "The transaction could not be captured by PayPal."}
            </p>
          </div>

          {token && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs flex justify-between items-center font-mono">
              <span className="text-slate-400">PayPal Order ID:</span>
              <span className="text-rose-400">{token}</span>
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-2 flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition text-center flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Mandate Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function PayPalReturnPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
            <div className="h-8 w-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-xs">Loading PayPal return session...</p>
          </div>
        }
      >
        <PayPalReturnContent />
      </Suspense>
    </div>
  );
}

