import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("真实 PostgreSQL 双连接集成入口",()=>{
  it("基础集成脚本缺少测试库时明确跳过", async () => {
    const source = await readFile(
      join(process.cwd(), "scripts", "verify-postgres-integration.ts"),
      "utf8",
    );
    expect(source).toMatch(/if\s*\(!testUrl\)[\s\S]*SKIP[\s\S]*return/);
  });
  it("无 TEST_DATABASE_URL 时明确跳过且不伪运行",async()=>{const source=await readFile(join(process.cwd(),"scripts","verify-postgres-user-library.ts"),"utf8");expect(source).toMatch(/TEST_DATABASE_URL/);expect(source).toMatch(/if\s*\(!testUrl\)[\s\S]*SKIP[\s\S]*return/);expect(source).not.toMatch(/TEST_POSTGRES_DATABASE_URL/);});
  it("覆盖 50/51 竞争、锁回滚和软删除竞态",async()=>{const source=await readFile(join(process.cwd(),"scripts","verify-postgres-user-library.ts"),"utf8");expect(source).toMatch(/firstConnection\s*=\s*await pool\.connect/);expect(source).toMatch(/secondConnection\s*=\s*await pool\.connect/);expect(source).toMatch(/49[\s\S]*pg_advisory_xact_lock[\s\S]*50[\s\S]*ROLLBACK/);expect(source).toMatch(/FOR SHARE[\s\S]*lock_timeout[\s\S]*deleted_at[\s\S]*55P03/);});
  it("文档声明仅限一次性测试库及真实运行命令",async()=>{const doc=await readFile(join(process.cwd(),"docs","postgres-user-library-integration.md"),"utf8");expect(doc).toMatch(/TEST_DATABASE_URL/);expect(doc).toMatch(/disposable|一次性/i);expect(doc).toMatch(/npm run test:postgres:user-library/);expect(doc).toMatch(/SKIP/);});
});
