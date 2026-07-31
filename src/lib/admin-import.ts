import ExcelJS from "exceljs";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import { validateRecordFormData } from "./record-validation";

export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_MAX_ZIP_ENTRIES = 2_000;
export const IMPORT_MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class ImportValidationError extends Error {}

export type ImportFileInput = { name: string; type: string; bytes: Buffer };
export type ParsedImportRow = {
  rowNumber: number;
  rowData: Record<string, string>;
  record: PolysaccharideRecord | null;
  errors: string[];
  warnings: string[];
};

const require = createRequire(import.meta.url);
const unzipper = require("unzipper") as { Parse: (options: { forceStream: true }) => NodeJS.ReadWriteStream & AsyncIterable<AsyncIterable<Buffer>> & { destroy: () => void } };

export async function validateActualZipOutput(
  bytes: Buffer,
  options: { maxUncompressedBytes?: number; maxEntries?: number; timeoutMs?: number } = {},
) {
  const maxBytes = options.maxUncompressedBytes ?? IMPORT_MAX_UNCOMPRESSED_BYTES;
  const maxEntries = options.maxEntries ?? IMPORT_MAX_ZIP_ENTRIES;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const source = Readable.from(bytes);
  const parser = unzipper.Parse({ forceStream: true });
  let timer: NodeJS.Timeout | undefined;
  const validate = async () => {
    let entries = 0;
    let actualBytes = 0;
    source.pipe(parser);
    for await (const entry of parser) {
      entries += 1;
      if (entries > maxEntries) throw new ImportValidationError("ZIP 实际解压条目数量超过安全限制");
      for await (const chunk of entry) {
        actualBytes += chunk.length;
        if (actualBytes > maxBytes) throw new ImportValidationError("ZIP 实际解压输出超过 100 MB 安全限制");
      }
    }
  };
  try {
    await Promise.race([
      validate(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ImportValidationError("ZIP 实际解压校验超时")), timeoutMs); }),
    ]);
  } catch (error) {
    source.destroy();
    parser.destroy();
    if (error instanceof ImportValidationError) throw error;
    throw new ImportValidationError("XLSX ZIP 损坏或无法安全解压");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function inspectImportFile(file: ImportFileInput) {
  if (!file.bytes.length) throw new ImportValidationError("不能上传空文件");
  if (file.bytes.length > IMPORT_MAX_BYTES) throw new ImportValidationError("文件不能超过 10 MB");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new ImportValidationError("仅支持 .xlsx 文件");
  if (file.type !== XLSX_MIME) throw new ImportValidationError("文件 MIME 类型必须为 XLSX");
  if (file.bytes.length < 4 || file.bytes.readUInt32LE(0) !== 0x04034b50) throw new ImportValidationError("文件缺少 XLSX ZIP 签名");
  await validateActualZipOutput(file.bytes);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
  }
  return String(value);
}

export function assertNoSpreadsheetFormula(
  value: unknown,
  rowNumber: number,
  columnNumber: number,
  fieldLabel: string,
) {
  if (
    value
    && typeof value === "object"
    && ("formula" in value || "sharedFormula" in value)
  ) {
    throw new ImportValidationError(
      `第 ${rowNumber} 行，第 ${columnNumber} 列，字段“${fieldLabel}”包含公式；整批导入已拒绝`,
    );
  }
}

export function normalizeImportDoi(value: string) {
  return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLowerCase();
}

export async function parseImportWorkbook(bytes: Buffer) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as never);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new ImportValidationError("工作簿没有工作表");
    const expected = FIELD_DEFINITIONS.map(({ label }) => label);
    FIELD_DEFINITIONS.forEach(({ label }, index) => {
      assertNoSpreadsheetFormula(sheet.getCell(1, index + 1).value, 1, index + 1, label);
    });
    const actual = Array.from({ length: sheet.columnCount }, (_, index) => cellText(sheet.getCell(1, index + 1).value).trim());
    if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
      throw new ImportValidationError("模板必须严格包含按既定顺序排列的 42 个字段");
    }
    const rows: ParsedImportRow[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      for (let index = 0; index < FIELD_DEFINITIONS.length; index += 1) {
        const value = sheet.getCell(rowNumber, index + 1).value;
        assertNoSpreadsheetFormula(
          value,
          rowNumber,
          index + 1,
          FIELD_DEFINITIONS[index].label,
        );
      }
      const rowData = Object.fromEntries(FIELD_DEFINITIONS.map(({ key }, index) => [key, cellText(sheet.getCell(rowNumber, index + 1).value).trim()]));
      if (Object.values(rowData).every((value) => !value)) continue;
      const formData = new FormData();
      for (const [key, value] of Object.entries(rowData)) formData.set(key, value);
      const result = validateRecordFormData(formData);
      rows.push({
        rowNumber,
        rowData,
        record: result.success ? result.record : null,
        errors: result.success ? [] : Object.values(result.state.fieldErrors),
        warnings: [],
      });
    }
    if (!rows.length) throw new ImportValidationError("工作簿没有可导入的数据行");
    return { rows };
  } catch (error) {
    if (error instanceof ImportValidationError) throw error;
    throw new ImportValidationError("XLSX 工作簿损坏或无法解析");
  }
}
