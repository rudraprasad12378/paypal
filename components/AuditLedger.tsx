"use client";

import React from "react";
import { FileText, ShieldAlert, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { AuditLog } from "@/types";

interface AuditLedgerProps {
  logs: AuditLog[];
}

export function AuditLedger({ logs }: AuditLedgerProps) {
  const getLevelIndicator = (level: AuditLog["level"]) => {
    switch (level) {
      case "success":
        return <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 mt-1" />;
      case "warning":
        return <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0 mt-1" />;
      case "danger":
        return <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0 mt-1 animate-ping" />;
      default:
        return <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0 mt-1" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            System Audit Trail
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
          IMMUTABLE LOGS
        </span>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto font-mono text-[11px]">
        {logs.map((log) => (
          <div
            key={log.id}
            className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-2.5 hover:border-slate-700 transition"
          >
            {getLevelIndicator(log.level)}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-200 truncate">
                  {log.title}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0 font-sans">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug break-words font-sans">
                {log.details}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
