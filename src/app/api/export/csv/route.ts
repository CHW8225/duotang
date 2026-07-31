import { buildCsvExport } from "@/lib/export";

import { exportFileName, getExportPayload } from "../shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { metadata, records } = await getExportPayload(searchParams);
  const csv = buildCsvExport(records, metadata);

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${exportFileName("csv")}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
