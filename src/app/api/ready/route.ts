import { NextResponse } from "next/server";
import { checkReadiness } from "@/lib/health";
import { getPostgresPool } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
  const result = await checkReadiness(getPostgresPool());
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
