import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import importedRecords from "../../data/import/polysaccharide-records.json";
import type { PolysaccharideRecord } from "./fields";
import { closeDatabaseConnection, getDatabase } from "./sqlite";
import {
  ImportConflictError,
  confirmImportJob,
  createImportPreview,
  getImportJob,
  mapStoredImportJob,
} from "./admin-import-repository";

let directory = "";
const base = importedRecords[0] as PolysaccharideRecord;

function row(overrides: Partial<PolysaccharideRecord> = {}) {
  const suffix = Math.random().toString(36).slice(2);
  const record = { ...base, upload_id: `new-${suffix}`, doi: `10.9999/${suffix}`, ...overrides };
  return { rowNumber: 2, rowData: record as unknown as Record<string, string>, record, errors: [], warnings: [] };
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "poly-import-"));
  process.env.DATABASE_PATH = join(directory, "test.sqlite3");
  delete process.env.DATABASE_URL;
});
afterEach(() => { closeDatabaseConnection(); rmSync(directory, { recursive: true, force: true }); delete process.env.DATABASE_PATH; });

describe("管理员导入预览与原子确认", () => {
  it("同时读取 PostgreSQL JSONB 与 SQLite JSON 字符串预览", () => {
    const job = mapStoredImportJob({ id: "j", filename: "a.xlsx", status: "ready", total_rows: 1, valid_rows: 1, error_rows: 0, conflict_rows: 0, warning_rows: 0, imported_rows: 0, created_by: "admin", created_at: "2026-01-01", completed_at: null }, [{ id: "r", row_number: 2, row_data: { upload_id: "u" }, errors: [], conflicts: [], warnings: [] }]);
    expect(job.rows[0].rowData.upload_id).toBe("u");
  });
  it("预览不写正式记录，并统计有效、错误、冲突和警告", async () => {
    const before = getDatabase().prepare("SELECT COUNT(*) count FROM polysaccharide_records").get() as { count: number };
    const job = await createImportPreview("test.xlsx", "admin", [
      row(),
      { ...row({ upload_id: "broken", standard_name: "" }), rowNumber: 3, errors: ["标准名称为必填项"] },
      { ...row({ upload_id: base.upload_id, doi: "10.9999/other" }), rowNumber: 4 },
    ]);
    const after = getDatabase().prepare("SELECT COUNT(*) count FROM polysaccharide_records").get() as { count: number };
    expect(after.count).toBe(before.count);
    expect(job).toMatchObject({ totalRows: 3, validRows: 1, errorRows: 1, conflictRows: 1, status: "invalid" });
  });

  it("检测批内重复上传编号和规范化 DOI", async () => {
    const job = await createImportPreview("test.xlsx", "admin", [
      row({ upload_id: "same", doi: "https://doi.org/10.9999/SAME" }),
      { ...row({ upload_id: "same", doi: "10.9999/same" }), rowNumber: 3 },
    ]);
    expect(job.conflictRows).toBe(2);
    expect(job.rows.every((item) => item.conflicts.length > 0)).toBe(true);
  });

  it("确认重新检查当前数据库冲突并阻止 TOCTOU", async () => {
    const preview = await createImportPreview("test.xlsx", "admin", [row({ upload_id: "toctou", doi: "10.9999/toctou" })]);
    getDatabase().prepare("UPDATE polysaccharide_records SET upload_id = ? WHERE id = ?").run("toctou", base.id);
    await expect(confirmImportJob(preview.id, "admin")).rejects.toBeInstanceOf(ImportConflictError);
    expect((await getImportJob(preview.id))?.status).toBe("ready");
  });

  it("单一事务导入全部记录、质量标记和一条 import 审计，且只能确认一次", async () => {
    const preview = await createImportPreview("test.xlsx", "admin", [row({ upload_id: "atomic-a", doi: "10.9999/atomic-a" }), { ...row({ upload_id: "atomic-b", doi: "10.9999/atomic-b" }), rowNumber: 3 }]);
    const result = await confirmImportJob(preview.id, "admin");
    expect(result.importedRows).toBe(2);
    const audit = getDatabase().prepare("SELECT * FROM audit_logs WHERE action = 'import' AND entity_id = ?").get(preview.id);
    expect(audit).toBeTruthy();
    await expect(confirmImportJob(preview.id, "admin")).rejects.toThrow("已确认");
  });

  it("审计写入失败时正式记录和任务状态全部回滚", async () => {
    const preview = await createImportPreview("test.xlsx", "admin", [row({ upload_id: "rollback", doi: "10.9999/rollback" })]);
    getDatabase().exec("CREATE TRIGGER fail_import_audit BEFORE INSERT ON audit_logs WHEN NEW.action = 'import' BEGIN SELECT RAISE(ABORT, 'audit failed'); END");
    await expect(confirmImportJob(preview.id, "admin")).rejects.toThrow("audit failed");
    expect(getDatabase().prepare("SELECT id FROM polysaccharide_records WHERE upload_id = 'rollback'").get()).toBeUndefined();
    expect((await getImportJob(preview.id))?.status).toBe("ready");
  });
});
