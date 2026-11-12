"use client";

import React, { useState } from "react";
import {
  ShoppingBag,
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldBan,
  ArrowRight,
  Plus,
} from "lucide-react";
import { CatalogProduct } from "@/types";

interface CatalogSectionProps {
  products: CatalogProduct[];
  isNegotiating: boolean;
  onSelectProduct: (product: CatalogProduct, userGoal?: string) => void;
  onCustomNegotiate: (customItem: {
    name: string;
    category: string;
    listPrice: number;
    minReservePrice: number;
    sellerName: string;
    description: string;
  }) => void;
}

export function CatalogSection({
  products,
  isNegotiating,
  onSelectProduct,
  onCustomNegotiate,
}: CatalogSectionProps) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("Electronics");
  const [customPrice, setCustomPrice] = useState(25);

  // Pre-configured test scenarios
  const scenarios = [
    {
      id: "scen-auto",
      title: "1. Auto-Approved Deal",
      subtitle: "Ergonomic Mouse ($28) → Neg. ~$22",
      badge: "Auto-Pay",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      icon: CheckCircle2,
      iconColor: "text-emerald-400",
      description: "Under $30 threshold & in-category. Guardrails auto-authorize & trigger PayPal checkout instantly.",
      productId: "prod-mouse-01",
    },
    {
      id: "scen-human",
      title: "2. Human Approval Gate",
      subtitle: "Mechanical Keyboard ($42) → Neg. ~$34",
      badge: "Flagged >$30",
      badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      icon: AlertTriangle,
      iconColor: "text-amber-400",
      description: "Valid category & under max cap ($45), but exceeds $30 threshold. Guardrails pause for 1-click user OK.",
      productId: "prod-keyboard-02",
    },
    {
      id: "scen-cap",
      title: "3. Item Cap Violation",
      subtitle: "Curved Ultrawide ($189) → Cap $45",
      badge: "Hard Rejection",
      badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      icon: XCircle,
      iconColor: "text-rose-400",
      description: "Agreed price exceeds $45 single-item ceiling. Guardrails veto deal before any payment.",
      productId: "prod-monitor-05",
    },
    {
      id: "scen-prohibited",
      title: "4. Policy & Risk Blacklist",
      subtitle: "Crypto Voucher ($40)",
      badge: "Policy Veto",
      badgeColor: "bg-red-500/10 text-red-400 border-red-500/30",
      icon: ShieldBan,
      iconColor: "text-red-400",
      description: "Prohibited category and blacklisted keyword ('crypto'). Immediate deterministic rejection.",
      productId: "prod-crypto-06",
    },
  ];

  const handleScenarioClick = (scen: (typeof scenarios)[0]) => {
    let prod = products.find((p) => p.id === scen.productId);
    if (!prod) {
      if (scen.id === "scen-auto") {
        prod = products.find((p) => p.listPrice <= 30) || products[0];
      } else if (scen.id === "scen-human") {
        prod = products.find((p) => p.listPrice > 35 && p.listPrice <= 45) || products[1];
      } else if (scen.id === "scen-cap") {
        prod = {
          id: "test-monitor-cap",
          name: "34-inch Curved Ultrawide Display",
          category: "gadgets",
          listPrice: 189.0,
          minReservePrice: 145.0,
          minPrice: 145.0,
          description: "High-spec curved display exceeding single item cap.",
          sellerName: "Display Direct",
          sellerStyle: "tough",
          imageEmoji: "🖥️",
        };
      } else if (scen.id === "scen-prohibited") {
        prod = {
          id: "test-crypto-voucher",
          name: "Crypto Mining Cloud Voucher",
          category: "prohibited",
          listPrice: 40.0,
          minReservePrice: 30.0,
          minPrice: 30.0,
          description: "Prohibited category and keyword test.",
          sellerName: "ShadowChain",
          sellerStyle: "tough",
          imageEmoji: "🪙",
        };
      }
    }
    if (prod) {
      onSelectProduct(prod);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    onCustomNegotiate({
      name: customName,
      category: customCategory,
      listPrice: Number(customPrice),
      minReservePrice: Number((customPrice * 0.75).toFixed(2)),
      sellerName: "Custom Merchant Direct",
      description: `User-specified item: ${customName}`,
    });
    setShowCustomModal(false);
    setCustomName("");
  };

  return (
    <div className="space-y-6">
      {/* 1. Quick Test Scenarios */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Hackathon Demo Scenarios
          </h2>
          <span className="text-[11px] text-slate-500">1-click end-to-end tests</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {scenarios.map((scen) => {
            const Icon = scen.icon;
            return (
              <button
                key={scen.id}
                onClick={() => handleScenarioClick(scen)}
                disabled={isNegotiating}
                className="text-left p-3 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between group disabled:opacity-50"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-xs text-white group-hover:text-blue-400 transition">
                      {scen.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${scen.badgeColor}`}
                    >
                      {scen.badge}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-300 mb-1">
                    {scen.subtitle}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {scen.description}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-blue-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Icon className={`h-3 w-3 ${scen.iconColor}`} />
                    Run Scenario
                  </span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Product Catalog */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5 text-blue-400" />
            Product Catalog
          </h2>
          <button
            onClick={() => setShowCustomModal(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition"
          >
            <Plus className="h-3 w-3" />
            <span>Custom Prompt</span>
          </button>
        </div>

        <div className="space-y-2">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0 p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                  {prod.imageEmoji}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-white truncate">
                      {prod.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">
                      {prod.category}
                    </span>
                    <span>By {prod.sellerName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-bold text-white font-mono">
                    ${prod.listPrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500">list price</div>
                </div>

                <button
                  onClick={() => onSelectProduct(prod)}
                  disabled={isNegotiating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition disabled:opacity-50"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>Negotiate</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Item Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">
              Custom AI Shopping Request
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Ask your Buyer AI to find and negotiate any product you want.
            </p>

            <form onSubmit={handleCustomSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Product Name / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Anker Wireless Earbuds"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Office & Desk">Office & Desk</option>
                    <option value="Peripherals">Peripherals</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Software & Tools">Software & Tools</option>
                    <option value="Prohibited">Prohibited (Test)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Merchant List Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white font-medium bg-blue-600 hover:bg-blue-500 transition shadow-lg"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>Start Negotiation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

