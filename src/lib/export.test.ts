import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import type { PolysaccharideRecord } from "./fields";
import {
  buildCsvExport,
  buildExcelExport,
  describeFilters,
  exportColumns,
} from "./export";

const record = {
  id: "record-1",
  standard_name: '灵芝多糖 "A"',
  source_species: "Ganoderma lucidum",
  conclusion: "line 1,\nline 2",
  publication_year: 2024,
  data_quality_flags: ["缺少 DOI"],
} as PolysaccharideRecord;

describe("scientific data export", () => {
  it("exports identifiers, all scientific fields, and traceability metadata", () => {
    const csv = buildCsvExport([record], {
      exportedAt: "2026-07-31T08:00:00.000Z",
      filterDescription: "关键词：灵芝",
    });

    expect(exportColumns.map(({ key }) => key)).toContain("id");
    expect(exportColumns.map(({ key }) => key)).toContain("standard_name");
    expect(csv).toContain("数据集版本");
    expect(csv).toContain("术语规则版本");
    expect(csv).toContain("导出时间");
    expect(csv).toContain("筛选条件");
    expect(csv).toContain('"灵芝多糖 ""A"""');
    expect(csv).toContain('"line 1,\nline 2"');
  });

  it("describes filters without inventing missing criteria", () => {
    expect(describeFilters({ keyword: "灵芝", hasDoi: true, page: 2 })).toBe(
      "关键词：灵芝；DOI：有",
    );
    expect(describeFilters({})).toBe("全部记录");
  });

  it("creates a readable workbook with metadata and the exact record count", async () => {
    const buffer = await buildExcelExport([record], {
      exportedAt: "2026-07-31T08:00:00.000Z",
      filterDescription: "关键词：灵芝",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets.map(({ name }) => name)).toEqual(["导出说明", "数据记录"]);
    expect(workbook.getWorksheet("数据记录")?.rowCount).toBe(2);
    expect(workbook.getWorksheet("数据记录")?.getCell("A2").value).toBe("record-1");
    expect(workbook.getWorksheet("导出说明")?.getCell("B4").value).toBe("关键词：灵芝");
  });

  it("neutralizes spreadsheet formulas in CSV text fields", () => {
    const csv = buildCsvExport(
      [{ ...record, standard_name: "=HYPERLINK(\"https://example.test\")" }],
      {
        exportedAt: "2026-07-31T08:00:00.000Z",
        filterDescription: "全部记录",
      },
    );

    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`);
    expect(csv).not.toContain(`,"=HYPERLINK`);
  });
});
