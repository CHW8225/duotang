import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("真实 PostgreSQL 生命周期双连接集成入口", () => {
  it("无 TEST_DATABASE_URL 时明确 SKIP", async () => {
    const source = await readFile(join(process.cwd(), "scripts", "verify-postgres-record-lifecycle.ts"), "utf8");
    expect(source).toMatch(/TEST_DATABASE_URL/);
    expect(source).toMatch(/if\s*\(!testUrl\)[\s\S]*SKIP[\s\S]*return/);
  });

  it("覆盖删除与恢复锁竞争、审计失败回滚及数据库类型", async () => {
    const source = await readFile(join(process.cwd(), "scripts", "verify-postgres-record-lifecycle.ts"), "utf8");
    expect(source).toMatch(/firstConnection\s*=\s*await pool\.connect/);
    expect(source).toMatch(/secondConnection\s*=\s*await pool\.connect/);
    expect(source).toMatch(/deleted_at IS NULL FOR UPDATE[\s\S]*lock_timeout/);
    expect(source).toMatch(/deleted_at IS NOT NULL FOR UPDATE[\s\S]*lock_timeout/);
    expect(source).toContain('"55P03"');
    expect(source).toMatch(/invalid_actor[\s\S]*ROLLBACK[\s\S]*deleted_at IS NULL/);
    expect(source).toMatch(/pg_typeof\(deleted_at\)[\s\S]*pg_typeof\(changed_fields\)/);
  });

  it("文档要求一次性测试库、迁移 0001 至 0005，并解释 SKIP", async () => {
    const doc = await readFile(join(process.cwd(), "docs", "postgres-record-lifecycle-integration.md"), "utf8");
    expect(doc).toMatch(/TEST_DATABASE_URL/);
    expect(doc).toMatch(/一次性|disposable/i);
    expect(doc).toMatch(/0001[\s\S]*0005/);
    expect(doc).toMatch(/npm run test:postgres:record-lifecycle/);
    expect(doc).toMatch(/SKIP/);
  });

  it("package script 暴露独立运行命令", async () => {
    const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8"));
    expect(packageJson.scripts["test:postgres:record-lifecycle"]).toBe(
      "tsx scripts/verify-postgres-record-lifecycle.ts",
    );
  });
});
