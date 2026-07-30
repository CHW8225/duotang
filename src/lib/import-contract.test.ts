import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type ImportManifest = {
  record_count: number;
  headers: string[];
  records: Array<{ id: string; excel_row: number }>;
};

const root = process.cwd();
const records = JSON.parse(
  readFileSync(join(root, "data/import/polysaccharide-records.json"), "utf8"),
) as Array<{ id: string; key_molecules: string }>;

describe("Excel import contract", () => {
  it("preserves literal N/A values and stable source rows", () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "data/import/polysaccharide-import-manifest.json"), "utf8"),
    ) as ImportManifest;

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

  it("passes the source workbook cell-by-cell verifier", () => {
    expect(() =>
      execFileSync("python", ["scripts/verify-excel-import.py"], {
        cwd: root,
        encoding: "utf8",
      }),
    ).not.toThrow();
  });
});
