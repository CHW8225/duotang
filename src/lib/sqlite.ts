import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import Database from "better-sqlite3";

import importedRecords from "../../data/import/polysaccharide-records.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";

type DatabaseState = {
  path: string;
  database: Database.Database;
};

type SqliteGlobal = typeof globalThis & {
  polysaccharideDatabase?: DatabaseState;
};

type StoredSessionRow = {
  id: string;
  username: string;
  authenticated_at: string;
  expires_at: string;
};

export type StoredSessionData = {
  id: string;
  username: string;
  authenticatedAt: string;
  expiresAt: string;
};

const sqliteGlobal = globalThis as SqliteGlobal;
const seedRecords = importedRecords as PolysaccharideRecord[];
const recordFieldKeys = FIELD_DEFINITIONS.map(({ key }) => key);
const recordColumns = [
  "id",
  ...recordFieldKeys,
  "data_quality_flags",
  "created_at",
  "updated_at",
] as const;

function databasePath() {
  const configuredPath = process.env.DATABASE_PATH?.trim();
  const defaultPath = join(
    /* turbopackIgnore: true */ process.cwd(),
    "data",
    "runtime",
    "polysaccharide.sqlite3",
  );
  return resolve(
    /* turbopackIgnore: true */ configuredPath || defaultPath,
  );
}

function recordValues(record: PolysaccharideRecord) {
  return recordColumns.map((column) => {
    if (column === "data_quality_flags") return JSON.stringify(record.data_quality_flags);
    return record[column];
  });
}

function rowToRecord(row: Record<string, unknown>): PolysaccharideRecord {
  const scientificFields = Object.fromEntries(
    recordFieldKeys.map((key) => [key, row[key] ?? (key === "publication_year" ? null : "")]),
  );
  return {
    ...scientificFields,
    id: String(row.id),
    publication_year:
      row.publication_year === null ? null : Number(row.publication_year),
    data_quality_flags: JSON.parse(String(row.data_quality_flags)) as string[],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  } as PolysaccharideRecord;
}

function createSchema(database: Database.Database) {
  const scientificColumns = FIELD_DEFINITIONS.map(({ key }) => {
    if (key === "publication_year") return `"${key}" INTEGER`;
    if (key === "review_status") {
      return `"${key}" TEXT NOT NULL CHECK (
        "${key}" IN ('待审核', '已审核', '需修改', '未标注')
      )`;
    }
    return `"${key}" TEXT NOT NULL DEFAULT ''`;
  }).join(",\n");
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS polysaccharide_records (
      id TEXT PRIMARY KEY,
      ${scientificColumns},
      data_quality_flags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_records_standard_name
      ON polysaccharide_records (standard_name);
    CREATE INDEX IF NOT EXISTS idx_records_updated_at
      ON polysaccharide_records (updated_at);
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      authenticated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
      ON admin_sessions (expires_at);
  `);
}

function initialize(database: Database.Database) {
  createSchema(database);
  const initializeTransaction = database.transaction(() => {
    const initialized = database
      .prepare("SELECT value FROM app_metadata WHERE key = ?")
      .get("seed_initialized");
    if (initialized) return;

    const { count } = database
      .prepare("SELECT COUNT(*) AS count FROM polysaccharide_records")
      .get() as { count: number };
    if (count === 0) {
      const insertSql = `
        INSERT INTO polysaccharide_records
        (${recordColumns.map((column) => `"${column}"`).join(", ")}, sort_order)
        VALUES (${recordColumns.map(() => "?").join(", ")}, ?)
      `;
      const insert = database.prepare(insertSql);
      seedRecords.forEach((record, index) => {
        insert.run(...recordValues(record), seedRecords.length - index);
      });
    }
    database
      .prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)")
      .run("seed_initialized", "1");
  });
  initializeTransaction.immediate();
}

export function getDatabase() {
  const path = databasePath();
  const current = sqliteGlobal.polysaccharideDatabase;
  if (current?.database.open && current.path === path) return current.database;
  if (current?.database.open) current.database.close();

  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");
  initialize(database);
  sqliteGlobal.polysaccharideDatabase = { path, database };
  return database;
}

export function closeDatabaseConnection() {
  const current = sqliteGlobal.polysaccharideDatabase;
  if (current?.database.open) current.database.close();
  delete sqliteGlobal.polysaccharideDatabase;
}

export function selectRecords(): PolysaccharideRecord[] {
  const rows = getDatabase()
    .prepare("SELECT * FROM polysaccharide_records ORDER BY sort_order DESC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

export function selectRecordById(id: string): PolysaccharideRecord | null {
  const row = getDatabase()
    .prepare("SELECT * FROM polysaccharide_records WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToRecord(row) : null;
}

export function insertRecord(record: PolysaccharideRecord) {
  const database = getDatabase();
  const insert = database.transaction(() => {
    const { sort_order: nextSortOrder } = database
      .prepare(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM polysaccharide_records",
      )
      .get() as { sort_order: number };
    database
      .prepare(`
        INSERT INTO polysaccharide_records
        (${recordColumns.map((column) => `"${column}"`).join(", ")}, sort_order)
        VALUES (${recordColumns.map(() => "?").join(", ")}, ?)
      `)
      .run(...recordValues(record), nextSortOrder);
    return record;
  });
  return insert.immediate();
}

export function replaceRecord(record: PolysaccharideRecord) {
  const assignments = recordColumns
    .filter((column) => column !== "id" && column !== "created_at")
    .map((column) => `"${column}" = ?`)
    .join(", ");
  const values = recordColumns
    .filter((column) => column !== "id" && column !== "created_at")
    .map((column) =>
      column === "data_quality_flags"
        ? JSON.stringify(record.data_quality_flags)
        : record[column],
    );
  const result = getDatabase()
    .prepare(`UPDATE polysaccharide_records SET ${assignments} WHERE id = ?`)
    .run(...values, record.id);
  return result.changes === 1 ? record : null;
}

export function insertAdminSession(session: StoredSessionData) {
  const database = getDatabase();
  const transaction = database.transaction(() => {
    database.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(
      new Date().toISOString(),
    );
    database.prepare(`
      INSERT INTO admin_sessions (id, username, authenticated_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(session.id, session.username, session.authenticatedAt, session.expiresAt);
  });
  transaction.immediate();
}

export function selectAdminSession(id: string): StoredSessionData | null {
  const database = getDatabase();
  const transaction = database.transaction(() => {
    database.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(
      new Date().toISOString(),
    );
    return database
      .prepare("SELECT * FROM admin_sessions WHERE id = ?")
      .get(id) as StoredSessionRow | undefined;
  });
  const row = transaction.immediate();
  return row
    ? {
        id: row.id,
        username: row.username,
        authenticatedAt: row.authenticated_at,
        expiresAt: row.expires_at,
      }
    : null;
}
