import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("阶段 5 导入契约", () => {
  it("0006 为预览增加统计、冲突和历史索引", () => {
    const sql = readFileSync("migrations/postgres/0006_admin_excel_import.sql", "utf8");
    for (const column of ["error_rows", "conflict_rows", "warning_rows", "imported_rows", "conflicts"]) expect(sql).toContain(column);
    expect(sql).toContain("idx_import_jobs_created_at");
  });

  it("0007 记录合法重复数据并且不创建破坏性唯一索引", () => {
    const sql = readFileSync("migrations/postgres/0007_import_concurrency_policy.sql", "utf8");
    expect(sql).toContain("217 duplicate groups");
    expect(sql).toContain("88 duplicate groups");
    expect(sql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
  });

  it("后台导航包含中文批量导入入口", () => {
    const source = readFileSync("src/components/AdminShell.tsx", "utf8");
    expect(source).toContain('href="/admin/import"');
    expect(source).toContain("批量导入");
  });

  it("导入确认和单条 PostgreSQL 新建共享同一个数据写锁", () => {
    const repository = readFileSync("src/lib/admin-import-repository.ts", "utf8");
    const postgres = readFileSync("src/lib/postgres.ts", "utf8");
    expect(repository).toMatch(/confirmPostgresJob[\s\S]*withPostgresDataWriteLock/);
    expect(postgres).toMatch(/insertPostgresRecord[\s\S]*withPostgresDataWriteLock/);
    expect(postgres).toMatch(/createPostgresRecordWithAudit[\s\S]*withPostgresDataWriteLock/);
  });

  it("PG与SQLite均提供可独立调用的30天级联清理", () => {
    const repository = readFileSync("src/lib/admin-import-repository.ts", "utf8");
    expect(repository).toMatch(/export async function cleanupExpiredImportJobs/);
    expect(repository).toMatch(/DELETE FROM import_jobs WHERE created_at < \$1 RETURNING id/);
    expect(repository).toMatch(/DELETE FROM import_jobs WHERE created_at < \?/);
    const schema = readFileSync("migrations/postgres/0001_initial_schema.sql", "utf8");
    expect(schema).toMatch(/import_job_id UUID NOT NULL REFERENCES import_jobs \(id\) ON DELETE CASCADE/);
  });
});
