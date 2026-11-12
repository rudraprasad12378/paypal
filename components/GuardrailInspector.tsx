"use client";

import React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { GuardrailEvaluation, Transaction } from "@/types";

interface GuardrailInspectorProps {
  guardrailResult: GuardrailEvaluation | null;
  transaction: Transaction | null;
  onApprove: (transactionId: string) => void;
  onReject: (transactionId: string) => void;
  isProcessingAction: boolean;
}

export function GuardrailInspector({
  guardrailResult,
  transaction,
  onApprove,
  onReject,
  isProcessingAction,
}: GuardrailInspectorProps) {
  if (!guardrailResult) {
    return (
      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
        <ShieldCheck className="h-10 w-10 text-slate-600 mb-2" />
        <h4 className="text-xs font-semibold text-slate-400">
          Guardrail Engine Waiting for Deal Proposal
        </h4>
        <p className="text-[11px] text-slate-500 max-w-xs mt-1">
          When agents conclude a negotiation, the proposal is audited by deterministic code before any payment.
        </p>
      </div>
    );
  }

  const isAutoApproved = guardrailResult.decision === "AUTO_APPROVED";
  const isNeedsApproval = guardrailResult.decision === "NEEDS_HUMAN_APPROVAL";
  const isRejected = guardrailResult.decision === "REJECTED";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header with Deterministic Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Lock className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Deterministic Guardrail Engine
            </h3>
            <p className="text-[10px] text-slate-400">
              Evaluated strictly in TypeScript code • Zero LLM authority over funds
            </p>
          </div>
        </div>

        {/* Engine Authority Badge */}
        <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-slate-950 text-blue-400 border border-blue-500/30 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          CODE ENFORCED
        </span>
      </div>

      {/* Decision Status Callout Banner */}
      <div
        className={`rounded-xl p-3.5 border flex items-start gap-3 ${
          isAutoApproved
            ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
            : isNeedsApproval
            ? "bg-amber-950/30 border-amber-500/40 text-amber-200"
            : "bg-rose-950/30 border-rose-500/40 text-rose-200"
        }`}
      >
        {isAutoApproved && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}
        {isNeedsApproval && <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />}
        {isRejected && <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />}

        <div className="text-xs flex-1">
          <div className="font-bold uppercase tracking-wider flex items-center justify-between">
            <span>
              Decision:{" "}
              {isAutoApproved
                ? "AUTO-APPROVED FOR CHECKOUT"
                : isNeedsApproval
                ? "HUMAN AUTHORIZATION REQUIRED"
                : "PROPOSAL REJECTED BY GUARDRAIL"}
            </span>
          </div>
          <p className="mt-1 text-[11px] opacity-90 leading-relaxed">
            {guardrailResult.reason}
          </p>
        </div>
      </div>

      {/* Audit Matrix Breakdown */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Guardrail Audit Checklist ({guardrailResult.checks.length} rules checked)
        </div>

        <div className="grid grid-cols-1 gap-2">
          {guardrailResult.checks.map((check) => (
            <div
              key={check.id}
              className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                check.passed
                  ? "bg-slate-950/50 border-slate-800 text-slate-300"
                  : "bg-rose-950/20 border-rose-900/40 text-rose-300"
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                {check.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <span>{check.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      [{check.id}]
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{check.details}</p>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                  check.passed
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {check.passed ? "PASSED" : "FAILED"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Human Approval Action Card (if flagged) */}
      {isNeedsApproval && transaction?.status === "PENDING_APPROVAL" && (
        <div className="p-4 rounded-xl bg-slate-950 border-2 border-amber-500/50 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Human Decision Required
            </span>
            <span className="text-xs font-mono font-bold text-white">
              Amount: ${transaction.amount.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-slate-300">
            This deal exceeds your auto-approve threshold. Do you authorize PayPal Sandbox to complete this purchase?
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => onApprove(transaction.id)}
              disabled={isProcessingAction}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Approve &amp; Pay via PayPal</span>
            </button>

            <button
              onClick={() => onReject(transaction.id)}
              disabled={isProcessingAction}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-rose-400 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 transition disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              <span>Veto Deal</span>
            </button>
          </div>
        </div>
      )}

      {/* Captured Payment Confirmation (if captured) */}
      {transaction?.status === "PAYPAL_CAPTURED" && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <div className="font-bold text-white">
                Payment Settled via PayPal Sandbox
              </div>
              <div className="text-[11px] font-mono text-emerald-300">
                Capture ID: {transaction.paypalCaptureId || "N/A"}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            COMPLETED
          </span>
        </div>
      )}
    </div>
  );
}
