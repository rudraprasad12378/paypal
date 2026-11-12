"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Tag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Bot,
} from "lucide-react";
import { CatalogProduct, Mandate } from "@/types";

interface ShoppingRequestBoxProps {
  products: CatalogProduct[];
  mandate: Mandate;
  onSelectProduct: (product: CatalogProduct, userGoal?: string) => void;
  onCustomNegotiate: (customItem: {
    name: string;
    category: string;
    listPrice: number;
    minReservePrice: number;
    sellerName: string;
    description: string;
  }) => void;
  isNegotiating: boolean;
  activeProductId?: string;
}

const QUICK_PROMPTS = [
  { label: "Wireless Headphones ($55)", query: "wireless headphones under $60", cat: "gadgets" },
  { label: "Mechanical Keyboard ($42)", query: "mechanical keyboard under $45", cat: "gadgets" },
  { label: "Pragmatic Programmer ($28)", query: "programming book under $30", cat: "books" },
  { label: "Organic Coffee Beans ($18)", query: "coffee beans", cat: "groceries" },
  { label: "Curved Display ($189 - Exceeds Cap)", query: "curved monitor", cat: "gadgets" },
  { label: "Crypto Voucher ($40 - Blacklist)", query: "crypto mining voucher", cat: "prohibited" },
];

export function ShoppingRequestBox({
  products,
  mandate,
  onSelectProduct,
  onCustomNegotiate,
  isNegotiating,
  activeProductId,
}: ShoppingRequestBoxProps) {
  const [query, setQuery] = useState("");

  // Filter matching products based on user query
  const matchingProducts = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return products.slice(0, 8);
    }

    // Extract potential price limit e.g. "under $60" or "under 60"
    const priceMatch = trimmed.match(/under\s*\$?(\d+)/i);
    const maxBudgetFilter = priceMatch ? parseFloat(priceMatch[1]) : null;

    return products.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(trimmed);
      const catMatch = p.category.toLowerCase().includes(trimmed);
      const descMatch = p.description?.toLowerCase().includes(trimmed);

      // Check keyword overlap
      const words = trimmed.split(" ").filter((w) => w.length > 2 && w !== "under");
      const wordMatch = words.some(
        (w) =>
          p.name.toLowerCase().includes(w) ||
          p.category.toLowerCase().includes(w) ||
          (p.description && p.description.toLowerCase().includes(w))
      );

      const priceOk = maxBudgetFilter ? p.listPrice <= maxBudgetFilter * 1.3 : true;

      return (nameMatch || catMatch || descMatch || wordMatch) && priceOk;
    });
  }, [products, query]);

  const handleQuickPromptClick = (prompt: (typeof QUICK_PROMPTS)[0]) => {
    setQuery(prompt.query);
  };

  const handleCustomSubmit = () => {
    if (!query.trim()) return;

    // Check if query contains price limit
    const priceMatch = query.match(/\$?(\d+(\.\d+)?)/);
    const parsedPrice = priceMatch ? parseFloat(priceMatch[1]) : 45.0;

    onCustomNegotiate({
      name: query.trim(),
      category: "gadgets",
      listPrice: parsedPrice,
      minReservePrice: Number((parsedPrice * 0.72).toFixed(2)),
      sellerName: "Direct Merchant",
      description: `Custom shopping request: ${query.trim()}`,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Shopping Request Box
            </h3>
            <p className="text-xs text-slate-400">
              Type what you need. AI Buyer negotiates with AI Seller within your mandate.
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
          <span>Catalog:</span>
          <strong className="text-slate-200">{products.length} items</strong>
        </div>
      </div>

      {/* Main Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Type what you want (e.g. "wireless headphones under $60", "ergonomic keyboard")...'
          className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick Suggestion Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-400" />
          Quick Scenarios:
        </span>
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p.label}
            onClick={() => handleQuickPromptClick(p)}
            className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-[11px] font-medium transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Matching Catalog Items Grid */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            {query.trim() ? "Matching Products" : "Featured Catalog Items"} ({matchingProducts.length})
          </span>
          <span className="text-[11px] text-slate-500">
            Click to dispatch Buyer AI &amp; Seller AI
          </span>
        </div>

        {matchingProducts.length === 0 ? (
          <div className="bg-slate-950/70 border border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-3">
            <p className="text-xs text-slate-400">
              No exact catalog match for &quot;{query}&quot;.
            </p>
            <button
              onClick={handleCustomSubmit}
              disabled={isNegotiating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/25 disabled:opacity-50"
            >
              <Bot className="h-4 w-4" />
              <span>Negotiate Custom Request: &quot;{query}&quot;</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto pr-1">
            {matchingProducts.map((prod) => {
              const isCategoryAllowed = mandate.allowedCategories.includes(prod.category);
              const exceedsCap = prod.listPrice > mandate.maxItemPrice;
              const isActive = activeProductId === prod.id && isNegotiating;

              return (
                <div
                  key={prod.id}
                  className={`bg-slate-950/80 border rounded-2xl p-3 flex flex-col justify-between transition hover:border-slate-700 group ${
                    isActive
                      ? "border-blue-500 ring-1 ring-blue-500"
                      : "border-slate-800/80"
                  }`}
                >
                  <div>
                    {/* Top: Category Tag & Icon */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xl">{prod.imageEmoji || "📦"}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          isCategoryAllowed
                            ? "bg-slate-800 text-slate-300 border-slate-700"
                            : "bg-rose-950/50 text-rose-300 border-rose-800/40"
                        }`}
                      >
                        {prod.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-blue-400 transition">
                      {prod.name}
                    </h4>

                    {/* List Price */}
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-sm font-bold font-mono text-white">
                        ${prod.listPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500">list price</span>
                    </div>
                  </div>

                  {/* Policy Indicators */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1 text-[10px]">
                    {!isCategoryAllowed ? (
                      <span className="text-rose-400 flex items-center gap-1 font-medium">
                        <XCircle className="h-3 w-3" /> Blocked Category
                      </span>
                    ) : exceedsCap ? (
                      <span className="text-amber-400 flex items-center gap-1 font-medium">
                        <AlertTriangle className="h-3 w-3" /> &gt; Cap (${mandate.maxItemPrice})
                      </span>
                    ) : prod.listPrice > mandate.approvalThreshold ? (
                      <span className="text-blue-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Needs Human OK
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Auto-Pay Eligible
                      </span>
                    )}

                    <button
                      onClick={() => onSelectProduct(prod, query || `Purchase ${prod.name}`)}
                      disabled={isNegotiating}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition shrink-0 flex items-center gap-1 shadow disabled:opacity-50"
                    >
                      {isActive ? (
                        <div className="h-2.5 w-2.5 rounded-full border border-white border-t-transparent animate-spin" />
                      ) : (
                        <span>Pick</span>
                      )}
                      <ArrowRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
