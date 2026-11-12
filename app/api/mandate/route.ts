import { NextRequest, NextResponse } from "next/server";
import { getMandate, updateMandate } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ mandate: getMandate() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const updates: Record<string, unknown> = {};

    if (typeof body.totalBudget === "number" && body.totalBudget > 0) {
      updates.totalBudget = body.totalBudget;
      const current = getMandate();
      // recalculate remaining budget relative to spent
      const newRemaining = Math.max(0, body.totalBudget - current.spentAmount);
      updates.remainingBudget = Number(newRemaining.toFixed(2));
    }

    if (typeof body.maxItemPrice === "number" && body.maxItemPrice > 0) {
      updates.maxItemPrice = body.maxItemPrice;
    }

    if (typeof body.approvalThreshold === "number" && body.approvalThreshold > 0) {
      updates.approvalThreshold = body.approvalThreshold;
    }

    if (Array.isArray(body.allowedCategories)) {
      updates.allowedCategories = body.allowedCategories.map(String);
    }

    if (Array.isArray(body.blockedKeywords)) {
      updates.blockedKeywords = body.blockedKeywords.map(String);
    }

    const updated = updateMandate(updates);
    return NextResponse.json({ success: true, mandate: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update mandate" },
      { status: 400 }
    );
  }
}
