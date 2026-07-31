import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("真实 PostgreSQL 导入验证脚本契约", () => {
  const source = readFileSync("scripts/verify-postgres-admin-import.ts", "utf8");
  it("未配置 TEST_DATABASE_URL 时明确跳过", () => {
    expect(source).toMatch(/if \(!testUrl\)[\s\S]*SKIP:/);
  });
  it("使用双连接和生产确认函数验证并发与回滚", () => {
    expect(source).toMatch(/pool\.connect\(\)[\s\S]*pool\.connect\(\)/);
    expect(source).toContain("confirmImportJob");
    expect(source).toMatch(/Promise\.allSettled/);
    expect(source).toContain("audit failure");
    expect(source).toContain("data_quality_flags");
    expect(source).toContain("jsonb");
    expect(source).toContain("createRecord");
    expect(source).toContain("sort_order");
    expect(source).toMatch(/createdSortOrder[\s\S]*importedSortOrders/);
    expect(source).toContain("new Set");
  });
});
