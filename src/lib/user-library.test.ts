import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabaseConnection, getDatabase } from "./sqlite";
import {
  LibraryError,
  createSqliteUserLibraryRepository,
  parseSavedSearchQuery,
} from "./user-library";

async function setupUser() {
  process.env.DATABASE_PATH ??= join(await mkdtemp(join(tmpdir(), "library-")), "test.sqlite3");
  const id = randomUUID();
  getDatabase().prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, `${id}@example.com`, "hash", new Date().toISOString(), "active", new Date().toISOString(), new Date().toISOString());
  return id;
}

describe("saved search query whitelist", () => {
  it("keeps only supported database parameters and canonical values", () => {
    expect(parseSavedSearchQuery("keyword=灵芝&activity=免疫调节&page=2&pageSize=50&sort=standard_name&evil=javascript%3Aalert(1)&returnTo=https%3A%2F%2Fevil.test"))
      .toEqual({ keyword: "灵芝", activity: "免疫调节", page: "2", pageSize: "50", sort: "standard_name" });
  });

  it("rejects a query containing no supported filter state", () => {
    expect(() => parseSavedSearchQuery("url=javascript%3Aalert(1)"))
      .toThrowError(LibraryError);
  });
});

describe("SQLite user library repository", () => {
  beforeEach(() => { closeDatabaseConnection(); delete process.env.DATABASE_PATH; });
  afterEach(() => { closeDatabaseConnection(); delete process.env.DATABASE_PATH; });

  it("isolates favorites by user and prevents duplicates", async () => {
    const userA = await setupUser();
    const userB = await setupUser();
    const repository = createSqliteUserLibraryRepository();
    await repository.addFavorite(userA, "poly-0001");
    await repository.addFavorite(userA, "poly-0001");
    expect(await repository.listFavorites(userA)).toHaveLength(1);
    expect(await repository.listFavorites(userB)).toHaveLength(0);
  });

  it("rejects soft-deleted records and hides them from existing favorites", async () => {
    const userId = await setupUser();
    const repository = createSqliteUserLibraryRepository();
    await repository.addFavorite(userId, "poly-0001");
    getDatabase().prepare("UPDATE polysaccharide_records SET deleted_at=? WHERE id=?")
      .run(new Date().toISOString(), "poly-0001");
    expect(await repository.listFavorites(userId)).toHaveLength(0);
    await expect(repository.addFavorite(userId, "poly-0001")).rejects.toThrow("记录不存在");
  });

  it("stores Chinese names, enforces unique names, and caps each user at 50 searches", async () => {
    const userId = await setupUser();
    const repository = createSqliteUserLibraryRepository();
    await repository.saveSearch(userId, "灵芝检索", { keyword: "灵芝" });
    await expect(repository.saveSearch(userId, "灵芝检索", { keyword: "其他" })).rejects.toThrow("名称已存在");
    for (let index = 1; index < 50; index += 1) await repository.saveSearch(userId, `检索${index}`, { page: String(index) });
    await expect(repository.saveSearch(userId, "第51条", { keyword: "超限" })).rejects.toThrow("最多保存 50 条");
  });
});
