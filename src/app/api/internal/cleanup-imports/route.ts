import { NextResponse } from "next/server";
import { cleanupExpiredImportJobs } from "@/lib/admin-import-repository";
import { authorizeCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizeCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const result = await cleanupExpiredImportJobs();
  return NextResponse.json(result);
}
