import { describe, expect, it, vi } from "vitest";

import { POSTGRES_DATA_WRITE_LOCK_KEY, assertPostgresImportIdentityAvailable, withPostgresDataWriteLock } from "./postgres";

describe("PostgreSQL 科研记录写锁", () => {
  it("使用固定事务级 advisory lock 包裹数据写入", async () => {
    const statements: string[] = [];
    const client = { query: vi.fn(async (sql: string) => { statements.push(sql); return { rows: [], rowCount: 0 }; }) };
    await withPostgresDataWriteLock(client, async () => { statements.push("WORK"); return "ok"; });
    expect(POSTGRES_DATA_WRITE_LOCK_KEY).toBeTypeOf("number");
    expect(statements[0]).toMatch(/pg_advisory_xact_lock/);
    expect(statements[1]).toBe("WORK");
    expect(client.query).toHaveBeenCalledWith(expect.stringMatching(/pg_advisory_xact_lock/), [POSTGRES_DATA_WRITE_LOCK_KEY]);
  });
  it("在锁内按非空上传编号和规范化 DOI 拒绝新冲突", async () => {
    const client = { query: vi.fn(async () => ({ rows: [{ id: "existing" }], rowCount: 1 })) };
    await expect(assertPostgresImportIdentityAvailable(client, "U1", "https://doi.org/10.1/ABC")).rejects.toThrow("冲突");
    expect(client.query).toHaveBeenCalledWith(expect.stringMatching(/upload_id[\s\S]*lower/), ["U1", "10.1/abc"]);
  });
});
