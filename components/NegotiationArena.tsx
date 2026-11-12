"use client";

import React from "react";
import { Bot, Store, Sparkles, CheckCircle2, TrendingDown } from "lucide-react";
import { DealProposal } from "@/types";

interface NegotiationArenaProps {
  deal: DealProposal | null;
  isNegotiating: boolean;
  activeProductTitle?: string;
}

export function NegotiationArena({
  deal,
  isNegotiating,
  activeProductTitle,
}: NegotiationArenaProps) {
  if (isNegotiating) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
        <div className="relative mb-4">
          <div className="h-16 w-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <Bot className="h-8 w-8 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h3 className="text-sm font-bold text-white mb-1">
          Buyer AI & Seller AI are Negotiating...
        </h3>
        <p className="text-xs text-slate-400 max-w-sm">
          {activeProductTitle
            ? `Bargaining price for ${activeProductTitle} within your mandate constraints.`
            : "Formulating counter-offers, evaluating reserve margins, and calculating savings."}
        </p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
        <Bot className="h-12 w-12 text-slate-600 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300 mb-1">
          Agent Negotiation Arena Idle
        </h3>
        <p className="text-xs text-slate-500 max-w-sm">
          Select a product or run one of the 1-click hackathon test scenarios on the left to watch the Buyer AI negotiate with the Seller AI live.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Agent Negotiation Transcript
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Deal ID:</span>
          <span className="text-slate-200">{deal.id.substring(0, 14)}...</span>
        </div>
      </div>

      {/* Transcript Turns */}
      <div className="p-4 sm:p-5 space-y-3.5 max-h-[360px] overflow-y-auto">
        {deal.turns.map((turn) => {
          const isBuyer = turn.speaker === "buyer";
          return (
            <div
              key={turn.turn}
              className={`flex items-start gap-3 ${
                isBuyer ? "" : "flex-row-reverse"
              }`}
            >
              {/* Avatar */}
              <div
                className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isBuyer
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                    : "bg-purple-600/20 border-purple-500/40 text-purple-400"
                }`}
              >
                {isBuyer ? <Bot className="h-4 w-4" /> : <Store className="h-4 w-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl p-3 text-xs ${
                  isBuyer
                    ? "bg-slate-800/80 border border-slate-700/60 text-slate-200 rounded-tl-sm"
                    : "bg-purple-950/30 border border-purple-800/40 text-slate-200 rounded-tr-sm"
                }`}
              >
                {/* Speaker & Price Header */}
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="font-bold text-[11px] text-white">
                    {turn.speakerName}
                  </span>
                  {turn.proposedPrice !== undefined && (
                    <span
                      className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-full border ${
                        isBuyer
                          ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                          : "bg-purple-500/20 border-purple-500/40 text-purple-300"
                      }`}
                    >
                      Offer: ${turn.proposedPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Speech Content */}
                <p className="leading-relaxed text-slate-300">{turn.message}</p>

                {/* Internal Thought Bubble */}
                {turn.thought && (
                  <div className="mt-2 pt-2 border-t border-slate-700/40 text-[10px] text-slate-400 flex items-start gap-1 italic">
                    <span className="text-slate-500 font-semibold not-italic shrink-0">
                      Reasoning:
                    </span>
                    <span>{turn.thought}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Proposal Summary Banner */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] text-slate-400 font-medium">
            Negotiation Outcome:
          </div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span>{deal.productName}</span>
            <span className="text-slate-400 text-xs">({deal.category})</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-slate-400">List Price</div>
            <div className="text-xs line-through text-slate-400 font-mono">
              ${deal.listPrice.toFixed(2)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
              <TrendingDown className="h-3 w-3" />
              Agreed Price
            </div>
            <div className="text-base font-extrabold text-emerald-400 font-mono">
              ${deal.agreedPrice.toFixed(2)}
            </div>
          </div>

          {deal.savings > 0 && (
            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              Saved ${deal.savings.toFixed(2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
