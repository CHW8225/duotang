import { getRecords } from "@/lib/db";
import { describeFilters } from "@/lib/export";
import { filterRecords, parseRecordQuery, type RecordQueryInput } from "@/lib/search";

export async function getExportPayload(searchParams: URLSearchParams) {
  const input: RecordQueryInput = Object.fromEntries(searchParams.entries());
  const filters = parseRecordQuery(input);
  const records = await getRecords();
  const ids = [...new Set((searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean))]
    .slice(0, 10);
  const selectedIds = new Set(ids);
  const exportedRecords = ids.length
    ? records.filter((record) => selectedIds.has(record.id))
    : filterRecords(records, filters);

  return {
    records: exportedRecords,
    metadata: {
      exportedAt: new Date().toISOString(),
      filterDescription: ids.length
        ? `已选记录：${exportedRecords.length} 条`
        : describeFilters(filters),
    },
  };
}

export const exportFileName = (extension: "csv" | "xlsx") => {
  const date = new Date().toISOString().slice(0, 10);
  return `polysaccharide-database-${date}.${extension}`;
};
