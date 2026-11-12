import { NextResponse } from "next/server";
import { getState } from "@/lib/store";

export async function GET() {
  const state = getState();

  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ""
  );
  const hasPayPalKeys = Boolean(
    process.env.PAYPAL_CLIENT_ID &&
      (process.env.PAYPAL_SECRET || process.env.PAYPAL_CLIENT_SECRET) &&
      process.env.PAYPAL_CLIENT_ID !== "mock"
  );

  return NextResponse.json({
    ...state,
    envConfig: {
      hasGeminiKey,
      geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      hasPayPalKeys,
      paypalEnv: "sandbox",
      paypalMode: hasPayPalKeys ? "LIVE_SANDBOX" : "SIMULATED_SANDBOX",
    },
  });
}

