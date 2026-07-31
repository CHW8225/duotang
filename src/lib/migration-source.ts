import { readFile } from "node:fs/promises";

import Database from "better-sqlite3";

import { type PolysaccharideRecord } from "./fields";
import { MIGRATION_COLUMNS, serializeRecordForMigration } from "./migration-integrity";

type MigrationSource =
  | { kind: "json"; path: string }
  | { kind: "sqlite"; path: string };

function normalizeRecord(row: Record<string, unknown>): PolysaccharideRecord {
  const normalized = Object.fromEntries(
    MIGRATION_COLUMNS.map((column) => {
      if (column === "publication_year") {
        return [column, row[column] === null ? null : Number(row[column])];
      }
      if (column === "data_quality_flags") {
        return [
          column,
          Array.isArray(row[column])
            ? row[column]
            : JSON.parse(String(row[column] ?? "[]")),
        ];
      }
      return [column, String(row[column] ?? "")];
    }),
  );
  return normalized as PolysaccharideRecord;
}

export async function loadMigrationSource(source: MigrationSource) {
  if (source.kind === "json") {
    const parsed = JSON.parse(await readFile(source.path, "utf8")) as Record<string, unknown>[];
    return parsed.map(normalizeRecord).map(serializeRecordForMigration) as PolysaccharideRecord[];
  }

  const database = new Database(source.path, { readonly: true, fileMustExist: true });
  try {
    const rows = database
      .prepare(`SELECT ${MIGRATION_COLUMNS.map((column) => `"${column}"`).join(", ")}
        FROM polysaccharide_records ORDER BY id`)
      .all() as Record<string, unknown>[];
    return rows.map(normalizeRecord).map(serializeRecordForMigration) as PolysaccharideRecord[];
  } finally {
    database.close();
  }
}
