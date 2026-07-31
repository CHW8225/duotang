import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

const environment = { ...process.env };
const temporaryDirectories: string[] = [];

async function useTemporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "polysaccharide-sqlite-"));
  temporaryDirectories.push(directory);
  process.env.DATABASE_PATH = join(directory, "polysaccharide.sqlite3");
  return process.env.DATABASE_PATH;
}

afterEach(async () => {
  try {
    const { closeDatabaseConnection } = await import("./sqlite");
    closeDatabaseConnection();
  } catch {
    // The RED phase intentionally runs before the SQLite module exists.
  }
  vi.restoreAllMocks();
  vi.resetModules();
  process.env = { ...environment };
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("SQLite record database", () => {
  it("uses the local runtime default during development", async () => {
    const directory = await mkdtemp(join(tmpdir(), "polysaccharide-default-"));
    temporaryDirectories.push(directory);
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    delete process.env.DATABASE_PATH;
    process.env.NODE_ENV = "development";
    const database = await import("./db");

    await expect(database.getRecords()).resolves.toHaveLength(772);
    await expect(
      access(join(directory, "data", "runtime", "polysaccharide.sqlite3")),
    ).resolves.toBeUndefined();
  });

  it("fails loudly in production without an explicit database path", async () => {
    delete process.env.DATABASE_PATH;
    process.env.NODE_ENV = "production";
    const database = await import("./db");

    await expect(database.getRecords()).rejects.toThrow(
      /DATABASE_PATH.*persistent volume/i,
    );
  });

  it("accepts an explicit absolute database path in production", async () => {
    const databasePath = await useTemporaryDatabase();
    process.env.NODE_ENV = "production";
    const database = await import("./db");

    await expect(database.getRecords()).resolves.toHaveLength(772);
    await expect(access(databasePath)).resolves.toBeUndefined();
  });

  it("initializes a new database from the tracked 772-record seed", async () => {
    const databasePath = await useTemporaryDatabase();
    const database = await import("./db");

    await expect(database.getRecords()).resolves.toHaveLength(772);
    await expect(access(databasePath)).resolves.toBeUndefined();
    await expect(readdir(join(databasePath, ".."))).resolves.not.toContain(
      "polysaccharide-records.json",
    );
  });

  it("keeps created records after closing and reopening the database", async () => {
    await useTemporaryDatabase();
    const database = await import("./db");
    const [seedRecord] = await database.getRecords();
    const created = await database.createRecord({
      ...seedRecord,
      id: "persistent-record",
      standard_name: "Persisted record",
      created_at: "",
      updated_at: "",
    });

    const { closeDatabaseConnection } = await import("./sqlite");
    closeDatabaseConnection();
    vi.resetModules();
    const reloadedDatabase = await import("./db");

    await expect(reloadedDatabase.getRecordById(created.id)).resolves.toMatchObject({
      standard_name: "Persisted record",
    });
  });

  it("supports writes from two independent WAL connections", async () => {
    const databasePath = await useTemporaryDatabase();
    const database = await import("./db");
    await database.getRecords();
    const first = new Database(databasePath);
    const second = new Database(databasePath);
    first.pragma("journal_mode = WAL");
    second.pragma("journal_mode = WAL");
    first.pragma("busy_timeout = 5000");
    second.pragma("busy_timeout = 5000");

    try {
      first.prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)")
        .run("multi_connection_first", "written");
      second.prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)")
        .run("multi_connection_second", "written");

      expect(first.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(second.pragma("busy_timeout", { simple: true })).toBe(5000);
      expect(
        first.prepare(
          "SELECT COUNT(*) AS count FROM app_metadata WHERE key LIKE 'multi_connection_%'",
        ).get(),
      ).toEqual({ count: 2 });
    } finally {
      first.close();
      second.close();
    }
  });

  it("rolls back a duplicate-id write without damaging the existing row", async () => {
    await useTemporaryDatabase();
    const database = await import("./db");
    const [seedRecord] = await database.getRecords();
    const duplicate = {
      ...seedRecord,
      id: "transaction-record",
      standard_name: "Original",
      created_at: "",
      updated_at: "",
    };
    await database.createRecord(duplicate);

    await expect(
      database.createRecord({ ...duplicate, standard_name: "Duplicate" }),
    ).rejects.toThrow();
    await expect(database.getRecordById("transaction-record")).resolves.toMatchObject({
      standard_name: "Original",
    });
  });

  it("preserves created_at when an update includes form management values", async () => {
    await useTemporaryDatabase();
    const database = await import("./db");
    const [seedRecord] = await database.getRecords();
    const created = await database.createRecord({
      ...seedRecord,
      id: "created-at-record",
      created_at: "",
      updated_at: "",
    });

    const updated = await database.updateRecord(created.id, {
      standard_name: "Updated record",
      created_at: "",
      updated_at: "",
      data_quality_flags: [],
    });

    expect(updated).toMatchObject({
      standard_name: "Updated record",
      created_at: created.created_at,
    });
  });
});
