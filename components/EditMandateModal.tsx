"use client";

import React, { useState } from "react";
import { X, Save, ShieldAlert } from "lucide-react";
import { Mandate } from "@/types";

interface EditMandateModalProps {
  mandate: Mandate;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Mandate>) => Promise<void>;
}

export function EditMandateModal({
  mandate,
  isOpen,
  onClose,
  onSave,
}: EditMandateModalProps) {
  const [totalBudget, setTotalBudget] = useState(mandate.totalBudget);
  const [approvalThreshold, setApprovalThreshold] = useState(mandate.approvalThreshold);
  const [maxItemPrice, setMaxItemPrice] = useState(mandate.maxItemPrice);
  const [allowedCategoriesStr, setAllowedCategoriesStr] = useState(
    mandate.allowedCategories.join(", ")
  );
  const [blockedKeywordsStr, setBlockedKeywordsStr] = useState(
    mandate.blockedKeywords.join(", ")
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const allowedCategories = allowedCategoriesStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const blockedKeywords = blockedKeywordsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await onSave({
        totalBudget: Number(totalBudget),
        approvalThreshold: Number(approvalThreshold),
        maxItemPrice: Number(maxItemPrice),
        allowedCategories,
        blockedKeywords,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save mandate:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">Configure Spending Mandate</h3>
            <p className="text-xs text-slate-400">
              Deterministic parameters enforced on every AI transaction.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Total Budget ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="5"
                value={totalBudget}
                onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Auto-Approve Cap ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                required
              />
              <span className="text-[10px] text-slate-500">&gt; this requires human</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Single-Item Max ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={maxItemPrice}
                onChange={(e) => setMaxItemPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                required
              />
              <span className="text-[10px] text-slate-500">Absolute ceiling</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Approved Categories (comma separated)
            </label>
            <input
              type="text"
              value={allowedCategoriesStr}
              onChange={(e) => setAllowedCategoriesStr(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
            <span className="text-[10px] text-slate-500">
              Only items matching these categories can be authorized.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Blocked Keywords / Risk Blacklist (comma separated)
            </label>
            <input
              type="text"
              value={blockedKeywordsStr}
              onChange={(e) => setBlockedKeywordsStr(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
            <span className="text-[10px] text-slate-500">
              Any item containing these terms will be immediately rejected.
            </span>
          </div>

          <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-300">
              <strong>Deterministic Security:</strong> These rules are executed directly in TypeScript code before any call to PayPal Orders API v2. The AI agents cannot modify or bypass them.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-medium bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save Mandate"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

