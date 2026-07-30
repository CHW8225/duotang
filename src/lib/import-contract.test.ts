import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FIELD_DEFINITIONS } from "./fields";

type ImportManifest = {
  source_workbook: string;
  source_sha256: string;
  sheet: string;
  record_count: number;
  headers: string[];
  records: Array<{ id: string; excel_row: number }>;
};

const root = process.cwd();
const records = JSON.parse(
  readFileSync(join(root, "data/import/polysaccharide-records.json"), "utf8"),
) as Array<Record<string, unknown> & { id: string; key_molecules: string }>;
const manifest = JSON.parse(
  readFileSync(join(root, "data/import/polysaccharide-import-manifest.json"), "utf8"),
) as ImportManifest;

describe("Excel import contract", () => {
  it("preserves literal N/A values and stable source rows", () => {
    expect(records).toHaveLength(772);
    expect(new Set(records.map(({ id }) => id)).size).toBe(772);
    expect(
      records
        .filter(({ id }) => ["poly-0328", "poly-0331", "poly-0333"].includes(id))
        .map(({ key_molecules }) => key_molecules),
    ).toEqual(["N/A", "N/A", "N/A"]);
    expect(manifest.record_count).toBe(772);
    expect(manifest.headers).toHaveLength(42);
    expect(manifest.records.find(({ id }) => id === "poly-0328")?.excel_row).toBe(329);
    expect(manifest.records.find(({ id }) => id === "poly-0331")?.excel_row).toBe(332);
    expect(manifest.records.find(({ id }) => id === "poly-0333")?.excel_row).toBe(334);
  });

  it("keeps tracked records consistent with provenance and schema metadata", () => {
    expect(manifest.source_workbook).toBe("多糖数据填写所有.xlsx");
    expect(manifest.source_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.sheet).toBe("单表导入模板");
    expect(manifest.records.map(({ id }) => id)).toEqual(
      records.map(({ id }) => id),
    );
    expect(manifest.records.map(({ excel_row }) => excel_row)).toEqual(
      Array.from({ length: 772 }, (_, index) => index + 2),
    );
    for (const record of records) {
      expect(FIELD_DEFINITIONS.every(({ key }) => key in record)).toBe(true);
    }
  });
});
