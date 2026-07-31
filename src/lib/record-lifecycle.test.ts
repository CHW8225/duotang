import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnvironment = { ...process.env };
const temporaryDirectories: string[] = [];

async function useTemporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "record-lifecycle-"));
  temporaryDirectories.push(directory);
  process.env.DATABASE_PATH = join(directory, "database.sqlite3");
  delete process.env.DATABASE_URL;
}

afterEach(async () => {
  const { closeDatabaseConnection } = await import("./sqlite");
  closeDatabaseConnection();
  vi.resetModules();
  process.env = { ...originalEnvironment };
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("科研记录生命周期与审计", () => {
  it.each([499, 500])("SQLite 数据层接受 %i 字符删除原因", async (length) => {
    await useTemporaryDatabase();
    const db = await import("./db");
    const [record] = await db.getRecords();
    await expect(db.softDeleteRecord(record.id, "admin", "原".repeat(length), record.standard_name))
      .resolves.toMatchObject({ id: record.id });
  });

  it("SQLite 数据层拒绝绕过 Action 提交的 501 字符删除原因", async () => {
    await useTemporaryDatabase();
    const db = await import("./db");
    const sqlite = await import("./sqlite");
    const [record] = await db.getRecords();
    await expect(db.softDeleteRecord(record.id, "admin", "原".repeat(501), record.standard_name))
      .rejects.toMatchObject({ code: "REASON_TOO_LONG" });
    expect(sqlite.selectAuditLogs(record.id)).toHaveLength(0);
  });

  it("原子软删除后公共读取隐藏、后台读取保留并写入审计", async () => {
    await useTemporaryDatabase();
    const db = await import("./db");
    const sqlite = await import("./sqlite");
    const [record] = await db.getRecords();

    const deleted = await db.softDeleteRecord(
      record.id,
      "administrator",
      "重复记录",
      record.standard_name,
    );

    expect(deleted).toMatchObject({ id: record.id });
    await expect(db.getRecordById(record.id)).resolves.toBeNull();
    await expect(db.getRecordByIdIncludingDeleted(record.id)).resolves.toMatchObject({ id: record.id });
    expect(sqlite.selectAuditLogs(record.id)).toEqual([
      expect.objectContaining({
        action: "soft_delete",
        actor_id: "administrator",
        entity_id: record.id,
        changed_fields: expect.objectContaining({ deletion_reason: "重复记录" }),
      }),
    ]);
  });

  it("拒绝空原因、错误确认名称和重复删除且不写假审计", async () => {
    await useTemporaryDatabase();
    const db = await import("./db");
    const sqlite = await import("./sqlite");
    const [record] = await db.getRecords();

    await expect(db.softDeleteRecord(record.id, "admin", "", record.standard_name))
      .rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await expect(db.softDeleteRecord(record.id, "admin", "重复", "错误名称"))
      .rejects.toMatchObject({ code: "NAME_MISMATCH" });
    await db.softDeleteRecord(record.id, "admin", "重复", record.standard_name);
    await expect(db.softDeleteRecord(record.id, "admin", "再次删除", record.standard_name))
      .rejects.toMatchObject({ code: "NOT_ACTIVE" });

    expect(sqlite.selectAuditLogs(record.id)).toHaveLength(1);
  });

  it("恢复已删除记录并写入恢复审计", async () => {
    await useTemporaryDatabase();
    const db = await import("./db");
    const sqlite = await import("./sqlite");
    const [record] = await db.getRecords();
    await db.softDeleteRecord(record.id, "admin", "误录", record.standard_name);

    await expect(db.restoreRecord(record.id, "admin")).resolves.toMatchObject({ id: record.id });
    await expect(db.getRecordById(record.id)).resolves.toMatchObject({ id: record.id });
    await expect(db.restoreRecord(record.id, "admin"))
      .rejects.toMatchObject({ code: "NOT_DELETED" });
    expect(sqlite.selectAuditLogs(record.id).map(({ action }) => action)).toEqual([
      "restore",
      "soft_delete",
    ]);
  });

  it("新建与编辑记录和审计处于同一写事务", async () => {
    await useTemporaryDatabase();
    const db = await import("./db");
    const sqlite = await import("./sqlite");
    const [seed] = await db.getRecords();
    const created = await db.createRecord({ ...seed, id: "audit-create", standard_name: "审计测试" }, "admin");
    await db.updateRecord(created.id, { standard_name: "审计测试更新" }, "admin");

    expect(sqlite.selectAuditLogs(created.id).map(({ action }) => action)).toEqual([
      "update",
      "create",
    ]);
    expect(sqlite.selectAuditLogs(created.id)[0].changed_fields).toHaveProperty("standard_name");
  });
});
