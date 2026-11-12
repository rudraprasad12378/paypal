import { NextRequest, NextResponse } from "next/server";
import { setKillSwitch, getMandate } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const active = Boolean(body.active);
    const updatedMandate = setKillSwitch(active);

    return NextResponse.json({
      success: true,
      killSwitchActive: updatedMandate.killSwitchActive,
      mandate: updatedMandate,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to toggle kill switch",
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  const mandate = getMandate();
  return NextResponse.json({
    killSwitchActive: mandate.killSwitchActive,
  });
}
