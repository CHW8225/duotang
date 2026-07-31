import { describe, expect, it } from "vitest";
import records from "../../data/import/polysaccharide-records.json";
import { normalizeImportDoi } from "./admin-import";

function duplicateSummary(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const duplicates = [...counts.values()].filter((count) => count > 1);
  return { groups: duplicates.length, rows: duplicates.reduce((sum, count) => sum + count, 0) };
}

describe("现有科研数据导入标识审计", () => {
  it("记录阻止 upload_id 唯一索引的合法重复基线", () => {
    expect(duplicateSummary(records.map(({ upload_id }) => upload_id.trim()))).toEqual({ groups: 217, rows: 762 });
  });
  it("记录阻止规范化 DOI 唯一索引的合法重复基线", () => {
    expect(duplicateSummary(records.map(({ doi }) => normalizeImportDoi(doi)))).toEqual({ groups: 88, rows: 311 });
  });
});
