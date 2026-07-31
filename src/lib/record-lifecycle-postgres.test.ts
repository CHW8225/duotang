import { describe, expect, it, vi } from "vitest";

import importedRecords from "../../data/import/polysaccharide-records.json";
import {
  runPostgresSoftDelete,
  runPostgresRestore,
  type PostgresQueryExecutor,
} from "./postgres";

function executorWithRow(row: Record<string, unknown>): PostgresQueryExecutor {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM polysaccharide_records")) {
        return { rows: [row], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }),
  };
}

describe("PostgreSQL 记录生命周期事务", () => {
  it.each([499, 500])("PostgreSQL 数据层接受 %i 字符删除原因", async (length) => {
    const executor = executorWithRow(importedRecords[0] as Record<string, unknown>);
    await expect(runPostgresSoftDelete(
      executor,
      importedRecords[0].id,
      "admin",
      "原".repeat(length),
      importedRecords[0].standard_name,
    )).resolves.toMatchObject({ id: importedRecords[0].id });
  });

  it("PostgreSQL 数据层在开启事务前拒绝 501 字符删除原因", async () => {
    const executor = executorWithRow(importedRecords[0] as Record<string, unknown>);
    await expect(runPostgresSoftDelete(
      executor,
      importedRecords[0].id,
      "admin",
      "原".repeat(501),
      importedRecords[0].standard_name,
    )).rejects.toMatchObject({ code: "REASON_TOO_LONG" });
    expect(executor.query).not.toHaveBeenCalled();
  });

  it("软删除锁定活动记录并在同一事务写审计", async () => {
    const executor = executorWithRow(importedRecords[0] as Record<string, unknown>);

    await runPostgresSoftDelete(
      executor,
      importedRecords[0].id,
      "admin",
      "重复记录",
      importedRecords[0].standard_name,
    );

    const sql = vi.mocked(executor.query).mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toMatch(/BEGIN[\s\S]*FOR UPDATE[\s\S]*SET deleted_at[\s\S]*INSERT INTO audit_logs[\s\S]*COMMIT/);
  });

  it("确认名称错误时回滚且不写审计", async () => {
    const executor = executorWithRow(importedRecords[0] as Record<string, unknown>);

    await expect(runPostgresSoftDelete(executor, importedRecords[0].id, "admin", "重复", "错误名称"))
      .rejects.toMatchObject({ code: "NAME_MISMATCH" });

    const sql = vi.mocked(executor.query).mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain("ROLLBACK");
    expect(sql).not.toContain("INSERT INTO audit_logs");
  });

  it("恢复只锁定已删除记录并原子清空删除元数据", async () => {
    const executor = executorWithRow({ ...importedRecords[0], deleted_at: new Date().toISOString() });

    await runPostgresRestore(executor, importedRecords[0].id, "admin");

    const sql = vi.mocked(executor.query).mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toMatch(/deleted_at IS NOT NULL FOR UPDATE[\s\S]*deleted_at = NULL[\s\S]*INSERT INTO audit_logs[\s\S]*COMMIT/);
  });
});
