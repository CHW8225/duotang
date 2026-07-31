import { describe, expect, it, vi } from "vitest";
import records from "../../data/import/polysaccharide-records.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import { insertPostgresImportRecords } from "./admin-import-repository";

function rowData(uploadId: string) {
  const source = records[0] as PolysaccharideRecord;
  return Object.fromEntries(FIELD_DEFINITIONS.map(({ key }) => [key, key === "upload_id" ? uploadId : String(source[key] ?? "")]));
}

describe("PostgreSQL 批量导入排序号", () => {
  it("逐行使用sequence并保持预览行顺序，不读取MAX(sort_order)", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client = { query: vi.fn(async (sql: string, values?: unknown[]) => { calls.push({ sql, values }); return { rows: [], rowCount: 1 }; }) };
    await insertPostgresImportRecords(client, [rowData("ordered-1"), rowData("ordered-2")]);
    expect(calls).toHaveLength(2);
    for (const { sql } of calls) {
      expect(sql).toContain("nextval('polysaccharide_record_sort_order_seq')");
      expect(sql).not.toMatch(/MAX\s*\(\s*sort_order/i);
    }
    expect(calls.map(({ values }) => values?.[1])).toEqual(["ordered-1", "ordered-2"]);
  });
});
