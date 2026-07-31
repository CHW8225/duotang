import ExcelJS from "exceljs";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";

import importedRecords from "../../data/import/polysaccharide-records.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import {
  ImportValidationError,
  assertNoSpreadsheetFormula,
  inspectImportFile,
  normalizeImportDoi,
  parseImportWorkbook,
  validateActualZipOutput,
} from "./admin-import";

const require = createRequire(import.meta.url);
const archiver = require("archiver") as (format: "zip", options: { zlib: { level: number } }) => NodeJS.ReadWriteStream & { append: (source: Buffer, options: { name: string }) => void; finalize: () => Promise<void> };

async function compressedZip(size: number, entries = 1) {
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(output);
  const completed = new Promise<void>((resolve, reject) => { output.on("end", resolve); output.on("error", reject); });
  for (let index = 0; index < entries; index += 1) archive.append(Buffer.alloc(size, 65), { name: `xl/worksheets/sheet${index + 1}.xml` });
  await archive.finalize();
  await completed;
  return Buffer.concat(chunks);
}

async function workbookBuffer(overrides: Partial<PolysaccharideRecord> = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("多糖数据");
  sheet.addRow(FIELD_DEFINITIONS.map(({ label }) => label));
  const record = { ...(importedRecords[0] as PolysaccharideRecord), ...overrides };
  sheet.addRow(FIELD_DEFINITIONS.map(({ key }) => record[key] ?? ""));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("管理员 Excel 导入安全解析", () => {
  it("拒绝空文件、超限文件、错误扩展名及伪造 MIME", async () => {
    await expect(inspectImportFile({ name: "a.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: Buffer.alloc(0) })).rejects.toThrow("空文件");
    await expect(inspectImportFile({ name: "a.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: Buffer.alloc(10 * 1024 * 1024 + 1) })).rejects.toThrow("10 MB");
    await expect(inspectImportFile({ name: "a.xls", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: Buffer.from("PK\u0003\u0004") })).rejects.toThrow(".xlsx");
    await expect(inspectImportFile({ name: "a.xlsx", type: "text/plain", bytes: Buffer.from("PK\u0003\u0004") })).rejects.toThrow("MIME");
  });

  it("拒绝没有 ZIP 签名及实际条目数超限的 ZIP bomb", async () => {
    await expect(inspectImportFile({ name: "a.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: Buffer.from("not zip") })).rejects.toThrow("ZIP");
    await expect(validateActualZipOutput(await compressedZip(8, 3), { maxEntries: 2 })).rejects.toThrow("条目");
  });

  it("按实际解压输出拒绝高压缩比与伪造中央目录大小", async () => {
    const zip = await compressedZip(2 * 1024 * 1024);
    for (let offset = 0; offset < zip.length - 46; offset += 1) {
      if (zip.readUInt32LE(offset) === 0x02014b50) zip.writeUInt32LE(1, offset + 24);
    }
    await expect(Promise.race([
      validateActualZipOutput(zip, { maxUncompressedBytes: 1024 * 1024, timeoutMs: 4_000 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ZIP 校验超时")), 5_000)),
    ])).rejects.toThrow("实际解压");
  }, 7_000);

  it("严格要求 FIELD_DEFINITIONS 的 42 个表头", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("错误模板").addRow(["标准名称"]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(parseImportWorkbook(bytes)).rejects.toThrow("42");
  });

  it("42个表头单元格出现公式即整批拒绝并报告行列字段", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("公式表头");
    sheet.addRow(FIELD_DEFINITIONS.map(({ label }, index) => index === 0 ? { formula: '"标准名称"', result: label } : label));
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(parseImportWorkbook(bytes)).rejects.toThrow(/第 1 行，第 1 列.*上传编号.*公式/);
  });

  it("共享公式表头对象即使带缓存result也被拒绝并报告行列字段", () => {
    expect(() => assertNoSpreadsheetFormula({ sharedFormula: "A1", result: FIELD_DEFINITIONS[1].label }, 1, 2, FIELD_DEFINITIONS[1].label))
      .toThrow(/第 1 行，第 2 列.*标准名称.*公式/);
  });

  it("复用记录校验并保留原始科研字段，不推断缺失数据", async () => {
    const parsed = await parseImportWorkbook(await workbookBuffer({ standard_name: "", publication_year: 9999 }));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].errors.join(" ")).toContain("标准名称");
    expect(parsed.rows[0].errors.join(" ")).toContain("发表年份");
    expect(parsed.rows[0].rowData.standard_name).toBe("");
  });

  it("任一42字段公式即整批拒绝并报告行号和字段，绝不采用缓存result", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("公式模板");
    sheet.addRow(FIELD_DEFINITIONS.map(({ label }) => label));
    const record = importedRecords[0] as PolysaccharideRecord;
    sheet.addRow(FIELD_DEFINITIONS.map(({ key }) => key === "standard_name" ? { formula: '"伪造名称"', result: "缓存名称" } : record[key] ?? ""));
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(parseImportWorkbook(bytes)).rejects.toThrow(/第 2 行，第 2 列.*标准名称.*公式/);
  });

  it("共享公式数据单元格即使带缓存result也被拒绝并报告行列字段", () => {
    expect(() => assertNoSpreadsheetFormula({ sharedFormula: "A2", result: "缓存名称" }, 3, 2, FIELD_DEFINITIONS[1].label))
      .toThrow(/第 3 行，第 2 列.*标准名称.*公式/);
  });

  it("规范化 DOI 用于冲突检测但不改写原始 DOI", () => {
    expect(normalizeImportDoi(" HTTPS://DOI.ORG/10.1000/AbC ")).toBe("10.1000/abc");
  });

  it("损坏工作簿返回中文校验错误", async () => {
    await expect(parseImportWorkbook(Buffer.from("PK\u0003\u0004broken"))).rejects.toBeInstanceOf(ImportValidationError);
  });
});
