import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import records from "../../data/import/polysaccharide-records.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";

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
  vi.unstubAllEnvs();
  vi.resetModules();
  process.env = { ...environment };
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("SQLite record database", () => {
  it("selects PostgreSQL only when DATABASE_URL is configured", async () => {
    const { resolveDatabaseBackend } = await import("./db");

    expect(resolveDatabaseBackend({ DATABASE_URL: "postgresql://db/app" })).toBe(
      "postgres",
    );
    expect(resolveDatabaseBackend({ DATABASE_PATH: "C:\\data\\app.sqlite3" })).toBe(
      "sqlite",
    );
  });

  it("uses the local runtime default during development", async () => {
    const directory = await mkdtemp(join(tmpdir(), "polysaccharide-default-"));
    temporaryDirectories.push(directory);
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    delete process.env.DATABASE_PATH;
    vi.stubEnv("NODE_ENV", "development");
    const database = await import("./db");

    await expect(database.getRecords()).resolves.toHaveLength(772);
    await expect(
      access(join(directory, "data", "runtime", "polysaccharide.sqlite3")),
    ).resolves.toBeUndefined();
  });

  it("fails loudly in production without an explicit database path", async () => {
    delete process.env.DATABASE_PATH;
    vi.stubEnv("NODE_ENV", "production");
    const database = await import("./db");

    await expect(database.getRecords()).rejects.toThrow(
      /DATABASE_PATH.*persistent volume/i,
    );
  });

  it("accepts an explicit absolute database path in production", async () => {
    const databasePath = await useTemporaryDatabase();
    vi.stubEnv("NODE_ENV", "production");
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

  it("hides soft-deleted records publicly while retaining an admin query", async () => {
    await useTemporaryDatabase();
    const database = await import("./db");
    const sqlite = await import("./sqlite");
    const [record] = await database.getRecords();

    sqlite.getDatabase().prepare(`
      UPDATE polysaccharide_records
      SET deleted_at = ?, deleted_by = ?, deletion_reason = ?
      WHERE id = ?
    `).run(new Date().toISOString(), "admin", "duplicate", record.id);

    await expect(database.getRecordById(record.id)).resolves.toBeNull();
    await expect(database.getRecords()).resolves.toHaveLength(771);
    await expect(database.getRecordsIncludingDeleted()).resolves.toHaveLength(772);
    await expect(database.getRecordByIdIncludingDeleted(record.id)).resolves.toMatchObject({
      id: record.id,
    });
  });

  it("upgrades an existing SQLite schema with soft-delete columns", async () => {
    const databasePath = await useTemporaryDatabase();
    const legacy = new Database(databasePath);
    const [record] = records as PolysaccharideRecord[];
    const scientificColumns = FIELD_DEFINITIONS.map(({ key }) =>
      `"${key}" ${key === "publication_year" ? "INTEGER" : "TEXT NOT NULL DEFAULT ''"}`,
    ).join(", ");
    legacy.exec(`
      CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO app_metadata (key, value) VALUES ('seed_initialized', '1');
      CREATE TABLE polysaccharide_records (
        id TEXT PRIMARY KEY, ${scientificColumns}, data_quality_flags TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, sort_order INTEGER NOT NULL
      );
      CREATE TABLE admin_sessions (
        id TEXT PRIMARY KEY, username TEXT NOT NULL,
        authenticated_at TEXT NOT NULL, expires_at TEXT NOT NULL
      );
    `);
    const columns = [
      "id",
      ...FIELD_DEFINITIONS.map(({ key }) => key),
      "data_quality_flags",
      "created_at",
      "updated_at",
      "sort_order",
    ];
    legacy.prepare(`INSERT INTO polysaccharide_records (${columns
      .map((column) => `"${column}"`)
      .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(
      ...columns.map((column) => {
        if (column === "sort_order") return 1;
        if (column === "data_quality_flags") return JSON.stringify(record.data_quality_flags);
        return record[column as keyof PolysaccharideRecord];
      }),
    );
    legacy.close();

    const database = await import("./db");

    await expect(database.getRecords()).resolves.toHaveLength(1);
    const sqlite = await import("./sqlite");
    expect(
      sqlite.getDatabase().prepare("PRAGMA table_info(polysaccharide_records)").all(),
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "deleted_at" }),
      expect.objectContaining({ name: "deleted_by" }),
      expect.objectContaining({ name: "deletion_reason" }),
    ]));
  });
});
