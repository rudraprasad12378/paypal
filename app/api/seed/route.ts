import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const seededState = seedDemoData();
    return NextResponse.json({
      success: true,
      message: "Realistic demo data seeded successfully.",
      state: seededState,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to seed demo data",
      },
      { status: 500 }
    );
  }
}
