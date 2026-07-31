import { buildExcelExport } from "@/lib/export";

import { exportFileName, getExportPayload } from "../shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { metadata, records } = await getExportPayload(searchParams);
  const workbook = await buildExcelExport(records, metadata);

  return new Response(workbook, {
    headers: {
      "Content-Disposition": `attachment; filename="${exportFileName("xlsx")}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
