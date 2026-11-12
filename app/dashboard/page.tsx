"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
} from "recharts";
import {
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  RotateCcw,
  DollarSign,
  TrendingUp,
  AlertOctagon,
  CreditCard,
  Lock,
  ExternalLink,
  Table,
  BarChart3,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { AppState, Transaction, Mandate, NegotiationRunRecord } from "@/types";

// Register all community modules for AG Grid
ModuleRegistry.registerModules([AllCommunityModule]);

interface GridRowData {
  id: string;
  time: string;
  product: string;
  category: string;
  listPrice: number;
  finalPrice: number;
  savings: number;
  status: string;
  guardrailReasons: string;
  attackFlag: boolean;
  paypalOrderId: string;
}

export default function DashboardPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Fetch state
  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error("Failed to load dashboard state:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Seed Demo Data
  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setState(data.state);
        } else {
          await loadState();
        }
      }
    } catch (err) {
      console.error("Failed to seed demo data:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Reset Demo Data
  const handleResetData = async () => {
    setIsResetting(true);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (res.ok) {
        await loadState();
      }
    } catch (err) {
      console.error("Failed to reset demo data:", err);
    } finally {
      setIsResetting(false);
    }
  };

  // Compute Summary Metrics
  const summaryMetrics = useMemo(() => {
    if (!state) {
      return { totalSpent: 0, totalSaved: 0, blockedCount: 0, attacksBlocked: 0 };
    }

    const txs = state.transactions || [];
    const runs = state.negotiationRuns || [];

    // Total Spent: sum of captured transactions
    const totalSpent = txs
      .filter((t) => t.status === "PAYPAL_CAPTURED")
      .reduce((sum, t) => sum + t.amount, 0);

    // Total Saved: calculated savings from negotiations + attack prevention ($500 override blocked)
    const runSavings = runs.reduce((sum, r) => sum + (r.savings > 0 ? r.savings : 0), 0);
    const attackPreventionSavings = runs
      .filter((r) => r.attackMode && r.status === "blocked")
      .reduce((sum, r) => sum + Math.max(0, 500 - r.listPrice), 0);
    const totalSaved = runSavings + attackPreventionSavings;

    // Blocked Count: count of transactions/runs with status blocked/rejected
    const blockedTx = txs.filter(
      (t) => t.status === "REJECTED_GUARDRAIL" || t.status === "REJECTED_HUMAN"
    ).length;
    const blockedRuns = runs.filter((r) => r.status === "blocked").length;
    const blockedCount = Math.max(blockedTx, blockedRuns);

    // Attacks Blocked: count of transactions/runs where attackFlag is true and blocked
    const attacksBlockedTx = txs.filter(
      (t) => t.attackFlag && (t.status === "REJECTED_GUARDRAIL" || t.status === "REJECTED_HUMAN")
    ).length;
    const attacksBlockedRuns = runs.filter((r) => r.attackMode && r.status === "blocked").length;
    const attacksBlocked = Math.max(attacksBlockedTx, attacksBlockedRuns);

    return {
      totalSpent: Number(totalSpent.toFixed(2)),
      totalSaved: Number(totalSaved.toFixed(2)),
      blockedCount,
      attacksBlocked,
    };
  }, [state]);

  // Chart Data: Spending vs Budget
  const chartData = useMemo(() => {
    if (!state?.mandate) return [];
    const m = state.mandate;
    return [
      { name: "Total Budget", amount: m.totalBudget, fill: "#3b82f6" },
      { name: "Spent Amount", amount: m.spentAmount, fill: "#10b981" },
      { name: "Remaining", amount: m.remainingBudget, fill: "#6366f1" },
    ];
  }, [state?.mandate]);

  // Format AG Grid Rows
  const rowData: GridRowData[] = useMemo(() => {
    if (!state?.transactions) return [];

    return state.transactions.map((tx) => {
      const listPrice = tx.listPrice || (tx.amount > 0 ? Number((tx.amount * 1.3).toFixed(2)) : 0);
      const savings = Math.max(0, Number((listPrice - tx.amount).toFixed(2)));

      return {
        id: tx.id,
        time: tx.createdAt,
        product: tx.productName,
        category: tx.category,
        listPrice,
        finalPrice: tx.amount,
        savings,
        status: tx.status,
        guardrailReasons: tx.guardrailResult?.reason || "Policy satisfied.",
        attackFlag: Boolean(tx.attackFlag),
        paypalOrderId: tx.paypalOrderId || "BLOCKED_BY_GUARDRAIL",
      };
    });
  }, [state?.transactions]);

  // AG Grid Column Definitions
  const colDefs = useMemo<ColDef<GridRowData>[]>(() => {
    return [
      {
        headerName: "Time",
        field: "time",
        width: 115,
        sortable: true,
        valueFormatter: (p) => {
          if (!p.value) return "-";
          try {
            return new Date(p.value).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
          } catch {
            return p.value;
          }
        },
      },
      {
        headerName: "Product",
        field: "product",
        width: 220,
        sortable: true,
        filter: true,
        cellRenderer: (params: { data?: GridRowData; value?: string }) => {
          if (!params.data) return null;
          return (
            <div className="flex items-center gap-2 truncate py-1">
              <span className="font-semibold text-white truncate text-xs">
                {params.value}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                {params.data.category}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "List Price",
        field: "listPrice",
        width: 105,
        sortable: true,
        valueFormatter: (p) => `$${Number(p.value).toFixed(2)}`,
        cellClass: "font-mono text-slate-400 text-xs",
      },
      {
        headerName: "Final Price",
        field: "finalPrice",
        width: 110,
        sortable: true,
        valueFormatter: (p) => `$${Number(p.value).toFixed(2)}`,
        cellClass: "font-mono font-bold text-white text-xs",
      },
      {
        headerName: "Status",
        field: "status",
        width: 160,
        sortable: true,
        filter: true,
        cellRenderer: (params: { value?: string }) => {
          const s = params.value;
          if (s === "PAYPAL_CAPTURED") {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                <CheckCircle2 className="h-3 w-3" /> Captured
              </span>
            );
          }
          if (s === "PENDING_APPROVAL") {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit animate-pulse">
                Needs Approval
              </span>
            );
          }
          if (s === "REJECTED_GUARDRAIL") {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit">
                <XCircle className="h-3 w-3" /> Blocked
              </span>
            );
          }
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 w-fit">
              {s}
            </span>
          );
        },
      },
      {
        headerName: "Attack Flag",
        field: "attackFlag",
        width: 140,
        sortable: true,
        filter: true,
        cellRenderer: (params: { value?: boolean }) => {
          if (params.value) {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1 w-fit">
                <ShieldAlert className="h-3 w-3 text-rose-400" />
                ATTACK ATTEMPT
              </span>
            );
          }
          return (
            <span className="text-[11px] text-slate-500 font-medium">
              Normal
            </span>
          );
        },
      },
      {
        headerName: "Guardrail Reasons",
        field: "guardrailReasons",
        flex: 1,
        minWidth: 260,
        sortable: true,
        tooltipField: "guardrailReasons",
        cellRenderer: (params: { value?: string }) => {
          return (
            <span
              className="text-xs text-slate-300 truncate block py-1"
              title={params.value}
            >
              {params.value}
            </span>
          );
        },
      },
      {
        headerName: "PayPal Order ID",
        field: "paypalOrderId",
        width: 190,
        sortable: true,
        cellRenderer: (params: { value?: string }) => {
          const id = params.value;
          if (!id || id === "BLOCKED_BY_GUARDRAIL") {
            return <span className="text-slate-500 text-[11px] font-mono">None (Blocked)</span>;
          }
          return (
            <a
              href={`https://www.sandbox.paypal.com/checkoutnow?token=${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline font-mono text-[11px] flex items-center gap-1"
              title="Inspect on PayPal Sandbox"
            >
              <span className="truncate">{id}</span>
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            </a>
          );
        },
      },
    ];
  }, []);

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      resizable: true,
    };
  }, []);

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-4">
        <div className="h-12 w-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin mb-4" />
        <h2 className="text-base font-bold text-white">Loading Executive Dashboard...</h2>
        <p className="text-xs text-slate-400 mt-1">Preparing AG Grid Community &amp; Financial Ledger</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Dashboard Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Page Identity */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="h-10 w-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 hover:bg-blue-600/30 transition shadow"
              title="Return to Live Arena"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  MANDATE
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    Analytics
                  </span>
                </h1>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PayPal AI Hackathon
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Executive Transaction Ledger • AG Grid Community • Financial Guardrails
              </p>
            </div>
          </div>

          {/* Action Buttons: Seed Demo Data, Reset, Navigation */}
          <div className="flex items-center gap-2.5">
            {/* Seed Demo Data Button */}
            <button
              onClick={handleSeedData}
              disabled={isSeeding}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-600/25 transition disabled:opacity-50"
            >
              <Sparkles className={`h-3.5 w-3.5 ${isSeeding ? "animate-spin" : ""}`} />
              <span>{isSeeding ? "Seeding..." : "Seed Demo Data"}</span>
            </button>

            {/* Reset Demo Data Button */}
            <button
              onClick={handleResetData}
              disabled={isResetting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`} />
              <span>Reset</span>
            </button>

            <Link
              href="/"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 transition"
            >
              <span>Live Arena</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ================================================================= */}
        {/* 1. SUMMARY CARDS (Total Spent, Total Saved, Blocked Count, Attacks) */}
        {/* ================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Card 1: Total Spent */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Total Spent</span>
              <CreditCard className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              ${summaryMetrics.totalSpent.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Captured via PayPal Sandbox v2
            </p>
          </div>

          {/* Card 2: Total Saved */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Total Saved</span>
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-blue-400">
              ${summaryMetrics.totalSaved.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Discounts &amp; overcharges prevented
            </p>
          </div>

          {/* Card 3: Blocked Count */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Blocked Count</span>
              <AlertOctagon className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-rose-400">
              {summaryMetrics.blockedCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Violations vetoed by deterministic code
            </p>
          </div>

          {/* Card 4: Attacks Blocked */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Attacks Blocked</span>
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
              {summaryMetrics.attacksBlocked}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              $500 prompt overrides &amp; urgency traps
            </p>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. SPENDING VS BUDGET BAR CHART (RECHARTS) */}
        {/* ================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Autonomous Spending vs Budget Allocation
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Mandate Currency: <strong>USD</strong>
            </span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Amount"]}
                  contentStyle={{
                    backgroundColor: "#020617",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. TRANSACTIONS TABLE (AG GRID COMMUNITY) */}
        {/* ================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Table className="h-4 w-4 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Transaction Audit Ledger (AG Grid Community)
                </h3>
                <p className="text-xs text-slate-400">
                  {rowData.length} transaction record{rowData.length === 1 ? "" : "s"} logged with full deterministic reasoning
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                AG Grid v36 Community
              </span>
            </div>
          </div>

          {/* AG Grid Table Container */}
          <div className="ag-theme-quartz-dark w-full h-[460px] rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
            <AgGridReact<GridRowData>
              rowData={rowData}
              columnDefs={colDefs}
              defaultColDef={defaultColDef}
              pagination={true}
              paginationPageSize={10}
              rowHeight={48}
              headerHeight={44}
            />
          </div>
        </div>
      </main>

      {/* Dashboard Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong>Mandate</strong> — AI Shopping Agent Wallet Dashboard
          </span>
          <span>
            AG Grid Community • Recharts • PayPal Sandbox Orders API v2
          </span>
        </div>
      </footer>
    </div>
  );
}
