import { NextResponse } from "next/server";
import { resetStore } from "@/lib/store";

export async function POST() {
  const freshState = resetStore();
  return NextResponse.json({
    success: true,
    message: "Mandate demo environment has been reset to factory defaults.",
    state: freshState,
  });
}
