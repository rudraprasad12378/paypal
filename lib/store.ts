import fs from "fs";
import path from "path";
import type { AppState, AuditLog, Mandate, Transaction, CatalogProduct } from "../types/index.ts";
import { INITIAL_CATALOG } from "./catalog.ts";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "mandate_store.json");

export const DEFAULT_MANDATE: Mandate = {
  totalBudget: 100.0,
  remainingBudget: 100.0,
  spentAmount: 0.0,
  maxItemPrice: 45.0,
  approvalThreshold: 30.0,
  allowedCategories: [
    "Electronics",
    "Office & Desk",
    "Peripherals",
    "Software & Tools",
    "Accessories",
  ],
  blockedKeywords: [
    "crypto",
    "bitcoin",
    "token",
    "gambling",
    "casino",
    "weapon",
    "adult",
    "gift card",
  ],
  killSwitchActive: false,
  currency: "USD",
  updatedAt: new Date().toISOString(),
};

function getInitialState(): AppState {
  return {
    mandate: { ...DEFAULT_MANDATE },
    transactions: [],
    auditLogs: [
      {
        id: "log-init",
        timestamp: new Date().toISOString(),
        eventType: "MANDATE_INIT",
        level: "info",
        title: "Mandate Wallet Initialized",
        details: "Spending mandate loaded: $100.00 total budget, $45.00 item max, $30.00 human approval threshold.",
      },
    ],
    products: [...INITIAL_CATALOG],
  };
}

// In-memory fallback
let memoryState: AppState = getInitialState();

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn("Could not create data directory, using in-memory store", err);
  }
}

export function getState(): AppState {
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(data) as AppState;
      memoryState = parsed;
      return parsed;
    } else {
      saveState(memoryState);
      return memoryState;
    }
  } catch (err) {
    console.warn("Error reading store from disk, returning memory state:", err);
    return memoryState;
  }
}

export function saveState(state: AppState): void {
  memoryState = state;
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.warn("Error saving store to disk:", err);
  }
}

export function getMandate(): Mandate {
  return getState().mandate;
}

export function updateMandate(updates: Partial<Mandate>): Mandate {
  const state = getState();
  const updatedMandate: Mandate = {
    ...state.mandate,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  state.mandate = updatedMandate;
  addAuditLog({
    eventType: "MANDATE_UPDATED",
    level: "info",
    title: "Mandate Parameters Updated",
    details: `Updated settings: Total Budget: $${updatedMandate.totalBudget.toFixed(2)}, Threshold: $${updatedMandate.approvalThreshold.toFixed(2)}, Max Item: $${updatedMandate.maxItemPrice.toFixed(2)}`,
    metadata: updates,
  });

  saveState(state);
  return updatedMandate;
}

export function setKillSwitch(active: boolean): Mandate {
  const state = getState();
  state.mandate.killSwitchActive = active;
  state.mandate.updatedAt = new Date().toISOString();

  addAuditLog({
    eventType: active ? "KILL_SWITCH_ENGAGED" : "KILL_SWITCH_RELEASED",
    level: active ? "danger" : "success",
    title: active ? "EMERGENCY KILL SWITCH ENGAGED" : "Kill Switch Deactivated",
    details: active
      ? "All AI shopping agent activities, negotiations, and payments are immediately frozen."
      : "Mandate wallet is operational. Shopping agent activities resumed.",
  });

  saveState(state);
  return state.mandate;
}

export function deductBudget(amount: number): boolean {
  const state = getState();
  if (state.mandate.remainingBudget < amount) {
    return false;
  }
  state.mandate.remainingBudget = Number((state.mandate.remainingBudget - amount).toFixed(2));
  state.mandate.spentAmount = Number((state.mandate.spentAmount + amount).toFixed(2));
  state.mandate.updatedAt = new Date().toISOString();
  saveState(state);
  return true;
}

export function getTransactions(): Transaction[] {
  return getState().transactions;
}

export function addTransaction(transaction: Transaction): Transaction {
  const state = getState();
  state.transactions.unshift(transaction);
  saveState(state);
  return transaction;
}

export function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Transaction | null {
  const state = getState();
  const index = state.transactions.findIndex((t) => t.id === id);
  if (index === -1) return null;

  state.transactions[index] = {
    ...state.transactions[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveState(state);
  return state.transactions[index];
}

export function getAuditLogs(): AuditLog[] {
  return getState().auditLogs;
}

export function addAuditLog(
  log: Omit<AuditLog, "id" | "timestamp">
): AuditLog {
  const state = getState();
  const entry: AuditLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  state.auditLogs.unshift(entry);
  if (state.auditLogs.length > 100) {
    state.auditLogs = state.auditLogs.slice(0, 100);
  }

  saveState(state);
  return entry;
}

export function getProducts(): CatalogProduct[] {
  return getState().products;
}

export function getProductById(id: string): CatalogProduct | undefined {
  return getState().products.find((p) => p.id === id);
}

export function resetStore(): AppState {
  const fresh = getInitialState();
  fresh.auditLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    eventType: "SYSTEM_RESET",
    level: "warning",
    title: "System Reset Executed",
    details: "Demo state, transactions, and mandate parameters reset to factory defaults.",
  });
  saveState(fresh);
  return fresh;
}
