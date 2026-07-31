import { getRecords } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = [...new Set((searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean))]
    .slice(0, 10);
  const selectedIds = new Set(ids);
  const records = (await getRecords()).filter((record) => selectedIds.has(record.id));
  return Response.json({ records });
}
