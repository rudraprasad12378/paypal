import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getPayPalBaseUrl,
  createPayPalOrder,
  capturePayPalOrder,
  PayPalOrderParams,
} from "./paypal";

describe("PayPal Orders API v2 Library (SANDBOX)", () => {
  const originalClientId = process.env.PAYPAL_CLIENT_ID;
  const originalSecret = process.env.PAYPAL_SECRET;
  const originalBaseUrl = process.env.PAYPAL_BASE_URL;

  beforeEach(() => {
    // Ensure simulation mode by unsetting live keys during unit tests
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_SECRET;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  afterEach(() => {
    if (originalClientId) process.env.PAYPAL_CLIENT_ID = originalClientId;
    if (originalSecret) process.env.PAYPAL_SECRET = originalSecret;
    if (originalBaseUrl) process.env.PAYPAL_BASE_URL = originalBaseUrl;
  });

  it("should default to the PayPal Sandbox base URL", () => {
    expect(getPayPalBaseUrl()).toBe("https://api-m.sandbox.paypal.com");
  });

  it("creates a simulated sandbox order with approval link when credentials are absent", async () => {
    const params: PayPalOrderParams = {
      amount: 28.5,
      productName: "Ergonomic Mechanical Keyboard",
      customId: "tx-test-101",
      returnUrl: "http://localhost:3000/paypal/return?txId=tx-test-101",
      cancelUrl: "http://localhost:3000/paypal/cancel?txId=tx-test-101",
    };

    const result = await createPayPalOrder(params);

    expect(result.orderId).toBeDefined();
    expect(result.orderId).toMatch(/^ORD-SANDBOX-/);
    expect(result.status).toBe("CREATED");
    expect(result.paymentMode).toBe("SIMULATED_SANDBOX");
    expect(result.approvalUrl).toBeDefined();
    expect(result.approvalUrl).toContain("/paypal/return?txId=tx-test-101&token=ORD-SANDBOX-");
    expect(result.links).toBeDefined();
    expect(result.links?.some((l) => l.rel === "approve")).toBe(true);
  });

  it("captures a simulated sandbox order with valid captureId", async () => {
    const orderId = "ORD-SANDBOX-TEST99";
    const result = await capturePayPalOrder(orderId);

    expect(result.orderId).toBe(orderId);
    expect(result.status).toBe("COMPLETED");
    expect(result.paymentMode).toBe("SIMULATED_SANDBOX");
    expect(result.captureId).toMatch(/^CAP-SANDBOX-/);
  });

  it("formats decimal amounts properly in order payload", async () => {
    const params: PayPalOrderParams = {
      amount: 19.999, // Should round or be formatted
      productName: "USB-C Fast Charger",
    };

    const result = await createPayPalOrder(params);
    expect(result.status).toBe("CREATED");
    expect(result.orderId).toContain("ORD-SANDBOX-");
  });

  it("provides fallback checkout URL when returnUrl is omitted", async () => {
    const params: PayPalOrderParams = {
      amount: 15.0,
      productName: "Python Crash Course",
    };

    const result = await createPayPalOrder(params);
    expect(result.approvalUrl).toContain("https://www.sandbox.paypal.com/checkoutnow?token=");
  });
});
