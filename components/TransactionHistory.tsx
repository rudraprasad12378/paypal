"use client";

import React, { useState } from "react";
import {
  Receipt,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Transaction } from "@/types";

interface TransactionHistoryProps {
  transactions: Transaction[];
  onApprovePending?: (txId: string) => void;
  onRejectPending?: (txId: string) => void;
  isProcessingAction?: boolean;
}

export function TransactionHistory({
  transactions,
  onApprovePending,
  onRejectPending,
  isProcessingAction,
}: TransactionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getStatusBadge = (status: Transaction["status"]) => {
    switch (status) {
      case "PAYPAL_CAPTURED":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Captured
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
            <Clock className="h-3 w-3" /> Needs Approval
          </span>
        );
      case "REJECTED_GUARDRAIL":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Guardrail Blocked
          </span>
        );
      case "REJECTED_HUMAN":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> User Vetoed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-3.5 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Transaction Ledger
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">
          {transactions.length} record{transactions.length === 1 ? "" : "s"}
        </span>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-500">
          No transactions yet. Run an agent negotiation to populate records.
        </div>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {transactions.map((tx) => {
            const isExpanded = expandedId === tx.id;
            return (
              <div
                key={tx.id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs transition hover:border-slate-700"
              >
                {/* Main Row */}
                <div
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate flex items-center gap-1.5">
                      <span>{tx.productName}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{tx.category}</span>
                      <span>•</span>
                      <span>
                        {new Date(tx.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-bold font-mono text-white">
                        ${tx.amount.toFixed(2)}
                      </div>
                      <div className="mt-0.5">{getStatusBadge(tx.status)}</div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                </div>

                {/* Inline Action for Pending Approvals */}
                {tx.status === "PENDING_APPROVAL" && onApprovePending && onRejectPending && (
                  <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => onApprovePending(tx.id)}
                      disabled={isProcessingAction}
                      className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow disabled:opacity-50"
                    >
                      Approve &amp; Pay
                    </button>
                    <button
                      onClick={() => onRejectPending(tx.id)}
                      disabled={isProcessingAction}
                      className="flex-1 py-1 px-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 font-bold text-[11px] transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-[11px] space-y-1.5 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Transaction ID:</span>
                      <span className="font-mono text-slate-200">{tx.id}</span>
                    </div>
                    {tx.paypalOrderId && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">PayPal Order ID:</span>
                        <span className="font-mono text-blue-400">
                          {tx.paypalOrderId}
                        </span>
                      </div>
                    )}
                    {tx.paypalCaptureId && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">PayPal Capture ID:</span>
                        <span className="font-mono text-emerald-400">
                          {tx.paypalCaptureId}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Payment Mode:</span>
                      <span className="text-slate-200">{tx.paymentMode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Guardrail Decision:</span>
                      <span className="font-mono text-white">
                        {tx.guardrailResult.decision}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                      Reason: {tx.guardrailResult.reason}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
