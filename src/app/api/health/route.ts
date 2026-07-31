import { NextResponse } from "next/server";
import { livenessPayload } from "@/lib/health";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(livenessPayload(), { headers: { "Cache-Control": "no-store" } });
}
