"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  DollarSign,
  Tag,
  Power,
  ShieldCheck,
  ShieldAlert,
  Check,
  Plus,
  Save,
  RotateCcw,
} from "lucide-react";
import { Mandate } from "@/types";

interface MandatePanelProps {
  mandate: Mandate;
  onUpdateMandate: (updates: Partial<Mandate>) => Promise<void>;
  onToggleKillSwitch: () => Promise<void>;
  isTogglingKillSwitch: boolean;
}

const DEFAULT_CATEGORIES = [
  "books",
  "gadgets",
  "groceries",
  "fashion",
  "gaming",
  "Electronics",
  "Office & Desk",
  "Peripherals",
  "Software & Tools",
];

export function MandatePanel({
  mandate,
  onUpdateMandate,
  onToggleKillSwitch,
  isTogglingKillSwitch,
}: MandatePanelProps) {
  const [dailyBudget, setDailyBudget] = useState(mandate.totalBudget);
  const [perPurchaseCap, setPerPurchaseCap] = useState(mandate.maxItemPrice);
  const [approvalThreshold, setApprovalThreshold] = useState(mandate.approvalThreshold);
  const [allowedCategories, setAllowedCategories] = useState<string[]>(
    mandate.allowedCategories || []
  );
  const [newCatInput, setNewCatInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if mandate updates from server
  useEffect(() => {
    setDailyBudget(mandate.totalBudget);
    setPerPurchaseCap(mandate.maxItemPrice);
    setApprovalThreshold(mandate.approvalThreshold);
    setAllowedCategories(mandate.allowedCategories || []);
  }, [mandate]);

  const toggleCategory = (cat: string) => {
    setAllowedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatInput.trim().toLowerCase();
    if (trimmed && !allowedCategories.includes(trimmed)) {
      setAllowedCategories((prev) => [...prev, trimmed]);
      setNewCatInput("");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onUpdateMandate({
        totalBudget: Number(dailyBudget),
        maxItemPrice: Number(perPurchaseCap),
        approvalThreshold: Number(approvalThreshold),
        allowedCategories,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error("Failed to update mandate:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const isKillSwitchActive = mandate.killSwitchActive;
  const budgetPct = Math.max(
    0,
    Math.min(100, (mandate.remainingBudget / mandate.totalBudget) * 100)
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Panel Top: Title & Big Red Kill Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sliders className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Spending Mandate Engine
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic spending limits enforced in plain code before any PayPal order.
          </p>
        </div>

        {/* BIG RED KILL SWITCH TOGGLE */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-2 rounded-2xl">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Emergency Kill Switch
            </div>
            <div
              className={`text-xs font-black ${
                isKillSwitchActive ? "text-rose-400 animate-pulse" : "text-emerald-400"
              }`}
            >
              {isKillSwitchActive ? "ENGAGED (FROZEN)" : "ARMED & SAFE"}
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleKillSwitch}
            disabled={isTogglingKillSwitch}
            aria-label="Toggle Emergency Kill Switch"
            className={`relative inline-flex h-9 w-20 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 focus:outline-none ${
              isKillSwitchActive
                ? "bg-rose-600 shadow-lg shadow-rose-600/50"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md transition duration-300 flex items-center justify-center ${
                isKillSwitchActive ? "translate-x-11 text-rose-600" : "translate-x-0 text-slate-700"
              }`}
            >
              <Power className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>

      {/* Kill Switch Active Warning Box */}
      {isKillSwitchActive && (
        <div className="bg-rose-950/40 border border-rose-600/50 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-rose-200 animate-pulse">
          <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
          <div>
            <strong className="font-bold text-white">Emergency Kill Switch is Active! </strong>
            All agent negotiations, auto-approvals, and PayPal checkouts are immediately blocked by deterministic code.
          </div>
        </div>
      )}

      {/* Budget Progress Meter */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
            <DollarSign className="h-3.5 w-3.5 text-blue-400" />
            Wallet Budget Pool
          </span>
          <span className="font-mono text-xs">
            Remaining: <strong className="text-emerald-400">${mandate.remainingBudget.toFixed(2)}</strong>{" "}
            <span className="text-slate-500">/ ${mandate.totalBudget.toFixed(2)}</span>
          </span>
        </div>

        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              budgetPct > 50
                ? "bg-gradient-to-r from-blue-500 to-emerald-400"
                : budgetPct > 20
                ? "bg-gradient-to-r from-blue-500 to-amber-400"
                : "bg-gradient-to-r from-amber-500 to-rose-500"
            }`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>

        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
          <span>Spent: ${mandate.spentAmount.toFixed(2)}</span>
          <span>{budgetPct.toFixed(0)}% available</span>
        </div>
      </div>

      {/* Form for Mandate Values */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* 1. Daily Budget */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Daily Total Budget ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="5"
                max="5000"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Total spend allowed today</p>
          </div>

          {/* 2. Per-Purchase Cap */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Per-Purchase Cap ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                max="1000"
                value={perPurchaseCap}
                onChange={(e) => setPerPurchaseCap(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Hard ceiling for 1 item</p>
          </div>

          {/* 3. Approval Threshold */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Approval Threshold ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                max="1000"
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">&gt; this requires human approval</p>
          </div>
        </div>

        {/* Allowed Categories Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-blue-400" />
              Allowed Categories (Click chip to toggle):
            </label>
            <span className="text-[10px] text-slate-500">
              {allowedCategories.length} category allowed
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            {DEFAULT_CATEGORIES.map((cat) => {
              const isAllowed = allowedCategories.includes(cat);
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer border ${
                    isAllowed
                      ? "bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm"
                      : "bg-slate-900/80 text-slate-500 border-slate-800 hover:text-slate-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isAllowed ? "bg-emerald-400" : "bg-slate-700"
                    }`}
                  />
                  <span>{cat}</span>
                  {isAllowed && <Check className="h-3 w-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Add custom category input */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="Add custom category..."
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>

        {/* Save Mandate CTA */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Changes persist immediately to deterministic engine.</span>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg ${
              saveSuccess
                ? "bg-emerald-600 text-white"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 disabled:opacity-50"
            }`}
          >
            {isSaving ? (
              <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-3.5 w-3.5 text-white" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>{isSaving ? "Saving..." : saveSuccess ? "Mandate Saved!" : "Save Mandate"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

