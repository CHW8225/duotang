import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import records from "../../data/import/polysaccharide-records.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import { loadMigrationSource } from "./migration-source";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("migration seed sources", () => {
  it("loads the tracked JSON seed without changing records", async () => {
    const loaded = await loadMigrationSource({
      kind: "json",
      path: join(process.cwd(), "data", "import", "polysaccharide-records.json"),
    });

    expect(loaded).toHaveLength(772);
    expect(loaded[0]).toEqual((records as PolysaccharideRecord[])[0]);
  });

  it("loads and normalizes records from an existing SQLite database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "migration-source-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "source.sqlite3");
    const database = new Database(path);
    const [source] = records as PolysaccharideRecord[];
    const columns = ["id", ...FIELD_DEFINITIONS.map(({ key }) => key), "data_quality_flags", "created_at", "updated_at"];
    database.exec(`CREATE TABLE polysaccharide_records (${columns
      .map((column) => `"${column}" ${column === "publication_year" ? "INTEGER" : "TEXT"}`)
      .join(", ")})`);
    database.prepare(`INSERT INTO polysaccharide_records (${columns
      .map((column) => `"${column}"`)
      .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(
      ...columns.map((column) =>
        column === "data_quality_flags"
          ? JSON.stringify(source.data_quality_flags)
          : source[column as keyof PolysaccharideRecord],
      ),
    );
    database.close();

    const loaded = await loadMigrationSource({ kind: "sqlite", path });

    expect(loaded).toEqual([source]);
  });
});
