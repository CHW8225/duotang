import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanupExpiredImportJobs } from "./admin-import-repository";
import { closeDatabaseConnection, getDatabase } from "./sqlite";

let directory = "";
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "import-cleanup-")); process.env.DATABASE_PATH = join(directory, "db.sqlite3"); delete process.env.DATABASE_URL; });
afterEach(() => { closeDatabaseConnection(); rmSync(directory, { recursive: true, force: true }); delete process.env.DATABASE_PATH; });

describe("过期导入任务清理", () => {
  it("可独立执行并级联删除过期任务行，保留未过期任务", async () => {
    const db = getDatabase();
    db.prepare("INSERT INTO import_jobs (id,filename,status,created_by,created_at) VALUES (?,?,?,?,?)").run("old", "old.xlsx", "ready", "admin", "2020-01-01T00:00:00.000Z");
    db.prepare("INSERT INTO import_job_rows (id,import_job_id,row_number,row_data) VALUES (?,?,?,?)").run("old-row", "old", 2, "{}");
    db.prepare("INSERT INTO import_jobs (id,filename,status,created_by,created_at) VALUES (?,?,?,?,?)").run("new", "new.xlsx", "ready", "admin", "2099-01-01T00:00:00.000Z");
    const result = await cleanupExpiredImportJobs(new Date("2026-08-01T00:00:00.000Z"));
    expect(result.deletedJobs).toBe(1);
    expect(db.prepare("SELECT id FROM import_jobs WHERE id='old'").get()).toBeUndefined();
    expect(db.prepare("SELECT id FROM import_job_rows WHERE id='old-row'").get()).toBeUndefined();
    expect(db.prepare("SELECT id FROM import_jobs WHERE id='new'").get()).toBeTruthy();
  });
});
