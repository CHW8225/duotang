import { resolve } from "node:path";

import { Pool } from "pg";

import { type PolysaccharideRecord } from "../src/lib/fields";
import { buildPostgresPoolConfig } from "../src/lib/postgres-config";
import {
  buildSeedVerification,
  MIGRATION_COLUMNS,
} from "../src/lib/migration-integrity";
import { loadMigrationSource } from "../src/lib/migration-source";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function sourceConfiguration() {
  const kind = argument("--source") ?? "json";
  if (kind !== "json" && kind !== "sqlite") {
    throw new Error("--source must be json or sqlite");
  }
  const defaultPath = kind === "json"
    ? "data/import/polysaccharide-records.json"
    : process.env.DATABASE_PATH;
  const path = argument("--path") ?? defaultPath;
  if (!path) throw new Error("--path or DATABASE_PATH is required for SQLite input");
  return { kind, path: resolve(path) } as const;
}

function normalizeTargetRow(row: Record<string, unknown>): PolysaccharideRecord {
  return Object.fromEntries(
    MIGRATION_COLUMNS.map((column) => [column, row[column]]),
  ) as PolysaccharideRecord;
}

async function main() {
  const records = await loadMigrationSource(sourceConfiguration());
  const sourceVerification = buildSeedVerification(records);
  if (sourceVerification.recordCount !== 772) {
    throw new Error(`Expected 772 source records, found ${sourceVerification.recordCount}`);
  }

  const pool = new Pool(buildPostgresPoolConfig());
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM polysaccharide_records",
    );
    if (Number(existing.rows[0].count) !== 0) {
      throw new Error("Target polysaccharide_records table must be empty");
    }

    const columns = MIGRATION_COLUMNS.map((column) => `"${column}"`).join(", ");
    const placeholders = MIGRATION_COLUMNS.map((_, index) => `$${index + 1}`).join(", ");
    const insertSql = `INSERT INTO polysaccharide_records (${columns}, sort_order)
      VALUES (${placeholders}, $${MIGRATION_COLUMNS.length + 1})`;
    for (const [index, record] of records.entries()) {
      await client.query(insertSql, [
        ...MIGRATION_COLUMNS.map((column) => record[column]),
        records.length - index,
      ]);
    }
    await client.query(
      "SELECT setval('polysaccharide_record_sort_order_seq', "
        + "(SELECT MAX(sort_order) FROM polysaccharide_records), true)",
    );

    const verificationColumns = MIGRATION_COLUMNS.map((column) => {
      if (column === "created_at" || column === "updated_at") {
        return `to_char(${column} AT TIME ZONE 'UTC', `
          + `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ${column}`;
      }
      return `"${column}"`;
    }).join(", ");
    const target = await client.query(
      `SELECT ${verificationColumns} FROM polysaccharide_records ORDER BY id`,
    );
    const targetVerification = buildSeedVerification(
      target.rows.map(normalizeTargetRow),
    );
    if (JSON.stringify(targetVerification) !== JSON.stringify(sourceVerification)) {
      throw new Error("PostgreSQL field hashes do not match the source seed");
    }
    await client.query("COMMIT");
    process.stdout.write(`${JSON.stringify(sourceVerification, null, 2)}\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
