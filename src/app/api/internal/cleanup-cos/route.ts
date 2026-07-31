import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { createTencentCosStore } from "@/lib/cos-store";
import { processCosCleanupJobs } from "@/lib/cos-cleanup";
export const runtime="nodejs";
export async function POST(request:Request){if(!authorizeCronRequest(request.headers.get("authorization")))return NextResponse.json({error:"未授权"},{status:401});return NextResponse.json(await processCosCleanupJobs(createTencentCosStore()));}
