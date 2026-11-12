import { describe, it, expect, beforeEach } from "vitest";
import { resetStore, seedDemoData, getState, getMandate, getTransactions } from "./store";

describe("Store Management (resetStore & seedDemoData)", () => {
  beforeEach(() => {
    resetStore();
  });

  it("resets store to factory defaults", () => {
    const state = resetStore();
    expect(state.mandate.totalBudget).toBe(100.0);
    expect(state.mandate.remainingBudget).toBe(100.0);
    expect(state.mandate.spentAmount).toBe(0.0);
    expect(state.mandate.killSwitchActive).toBe(false);
    expect(state.transactions.length).toBe(0);
  });

  it("seeds realistic demo rows for the hackathon dashboard", () => {
    const state = seedDemoData();

    // Check mandate
    expect(state.mandate.totalBudget).toBe(200.0);
    expect(state.mandate.spentAmount).toBe(119.0);
    expect(state.mandate.remainingBudget).toBe(81.0);

    // Check transactions
    expect(state.transactions.length).toBe(9);
    const captured = state.transactions.filter((t) => t.status === "PAYPAL_CAPTURED");
    const blocked = state.transactions.filter((t) => t.status === "REJECTED_GUARDRAIL");
    const pending = state.transactions.filter((t) => t.status === "PENDING_APPROVAL");
    const attacks = state.transactions.filter((t) => t.attackFlag);

    expect(captured.length).toBe(4);
    expect(blocked.length).toBe(4);
    expect(pending.length).toBe(1);
    expect(attacks.length).toBe(2);

    // Verify PayPal IDs on captured transactions
    captured.forEach((tx) => {
      expect(tx.paypalOrderId).toMatch(/^ORD-SANDBOX-/);
      expect(tx.paypalCaptureId).toMatch(/^CAP-SANDBOX-/);
    });

    // Check negotiation runs
    expect(state.negotiationRuns?.length).toBe(9);
  });
});

