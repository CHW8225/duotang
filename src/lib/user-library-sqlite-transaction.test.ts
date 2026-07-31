import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("SQLite 用户资料库写事务",()=>{
  it("收藏检查与插入在 immediate 事务中完成",async()=>{const source=await readFile(new URL("./user-library.ts",import.meta.url),"utf8");expect(source).toMatch(/async addFavorite[\s\S]*transaction\([\s\S]*deleted_at IS NULL[\s\S]*INSERT OR IGNORE INTO favorites[\s\S]*transaction\.immediate\(\)/);});
  it("保存数量检查与插入在 immediate 事务中完成",async()=>{const source=await readFile(new URL("./user-library.ts",import.meta.url),"utf8");expect(source).toMatch(/async saveSearch[\s\S]*transaction\([\s\S]*COUNT\(\*\)[\s\S]*INSERT INTO saved_searches[\s\S]*transaction\.immediate\(\)/);});
  it("软删除基础函数使用兼容的 immediate 写事务",async()=>{const source=await readFile(new URL("./sqlite.ts",import.meta.url),"utf8");expect(source).toMatch(/export function softDeleteRecord[\s\S]*transaction\([\s\S]*SET deleted_at[\s\S]*transaction\.immediate\(\)/);});
});
