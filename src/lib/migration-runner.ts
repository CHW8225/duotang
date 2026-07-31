import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const MIGRATION_LOCK_KEY = 2_026_080_7;

export type MigrationFile = {
  version: string;
  name: string;
  sql: string;
  hash: string;
};

export type AppliedMigration = Pick<MigrationFile, "version" | "name" | "hash">;

export type MigrationClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export function hashMigration(sql: string) {
  return createHash("sha256").update(sql.replace(/\r\n?/g, "\n")).digest("hex");
}

export function normalizeMigrationSql(sql: string) {
  return sql
    .replace(/^\s*BEGIN\s*;\s*/i, "")
    .replace(/\s*COMMIT\s*;\s*$/i, "")
    .trim();
}

function validateFiles(files: MigrationFile[]) {
  const versions = new Set<string>();
  for (const file of files) {
    if (versions.has(file.version)) throw new Error(`Migration 版本重复：${file.version}`);
    versions.add(file.version);
  }
  files.forEach((file, index) => {
    const expected = String(index + 1).padStart(4, "0");
    if (file.version !== expected) {
      throw new Error(`Migration 顺序不连续：应为 ${expected}，实际为 ${file.version}`);
    }
  });
}

export function assertMigrationHistory(files: MigrationFile[], applied: AppliedMigration[]) {
  validateFiles(files);
  for (const [index, item] of applied.entries()) {
    if (files[index]?.version !== item.version) {
      throw new Error(`已应用 migration 历史不连续：应为 ${files[index]?.version ?? "无"}，实际为 ${item.version}`);
    }
    const local = files.find((file) => file.version === item.version);
    if (!local) throw new Error(`数据库存在未知 migration：${item.version}`);
    if (local.name !== item.name || local.hash !== item.hash) {
      throw new Error(`已应用 migration 的名称或 hash 不一致，拒绝继续：${item.version}`);
    }
  }
}

export function buildMigrationPlan(files: MigrationFile[], applied: AppliedMigration[]) {
  assertMigrationHistory(files, applied);
  const appliedVersions = new Set(applied.map(({ version }) => version));
  return files.filter(({ version }) => !appliedVersions.has(version));
}

export async function loadMigrationFiles(directory: string) {
  const names = (await readdir(directory))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/i.test(name))
    .sort();
  const files = await Promise.all(names.map(async (name) => {
    const sql = await readFile(join(directory, name), "utf8");
    return { version: name.slice(0, 4), name, sql, hash: hashMigration(sql) };
  }));
  validateFiles(files);
  return files;
}

async function ensureMigrationTable(client: MigrationClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hash TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

export async function readAppliedMigrations(client: MigrationClient) {
  await ensureMigrationTable(client);
  const result = await client.query(
    "SELECT version, name, hash FROM schema_migrations ORDER BY version",
  );
  return result.rows.map((row) => ({
    version: String(row.version), name: String(row.name), hash: String(row.hash),
  }));
}

export async function runMigrations(client: MigrationClient, files: MigrationFile[]) {
  await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  try {
    const applied = await readAppliedMigrations(client);
    const pending = buildMigrationPlan(files, applied);
    for (const file of pending) {
      await client.query("BEGIN");
      try {
        await client.query(normalizeMigrationSql(file.sql));
        await client.query(
          "INSERT INTO schema_migrations (version, name, hash) VALUES ($1, $2, $3)",
          [file.version, file.name, file.hash],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return { applied: pending.map(({ name }) => name), pending: 0 };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
  }
}
