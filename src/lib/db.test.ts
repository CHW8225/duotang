import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  vi.resetModules();
  process.env = { ...environment };
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("SQLite record database", () => {
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

  it("commits concurrent creates without losing records", async () => {
    await useTemporaryDatabase();
    const database = await import("./db");
    const [seedRecord] = await database.getRecords();

    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        database.createRecord({
          ...seedRecord,
          id: `concurrent-${index}`,
          standard_name: `Concurrent ${index}`,
          created_at: "",
          updated_at: "",
        }),
      ),
    );

    const records = await database.getRecords();
    expect(records.filter(({ id }) => id.startsWith("concurrent-"))).toHaveLength(12);
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
