import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("PostgreSQL 用户资料库并发约束",()=>{
  it("在同一事务内按用户加锁后检查 50 条上限",async()=>{
    const source=await readFile(new URL("./user-library.ts",import.meta.url),"utf8");
    expect(source).toContain("withPostgresTransaction");
    expect(source).toMatch(/pg_advisory_xact_lock[\s\S]*COUNT\(\*\)[\s\S]*INSERT INTO saved_searches/);
  });
  it("在事务中锁定未删除记录后才写入收藏",async()=>{
    const source=await readFile(new URL("./user-library.ts",import.meta.url),"utf8");
    expect(source).toMatch(/deleted_at IS NULL FOR SHARE[\s\S]*INSERT INTO favorites/);
  });
});
