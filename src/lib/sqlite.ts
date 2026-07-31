import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import Database from "better-sqlite3";

import importedRecords from "../../data/import/polysaccharide-records.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import { RecordLifecycleError, validateDeletionReason } from "./record-lifecycle";
import { randomUUID } from "node:crypto";

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
  if (
    process.env.NODE_ENV === "production"
    && (!configuredPath || !isAbsolute(configuredPath))
  ) {
    throw new Error(
      "DATABASE_PATH is required in production and must be an absolute path "
      + "on a mounted persistent volume.",
    );
  }
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
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
    deleted_by: row.deleted_by ? String(row.deleted_by) : null,
    deletion_reason: row.deletion_reason ? String(row.deletion_reason) : null,
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
      sort_order INTEGER NOT NULL,
      deleted_at TEXT,
      deleted_by TEXT,
      deletion_reason TEXT
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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL, email_verified_at TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'disabled')),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS email_tokens (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL,
      expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_rate_limits (
      key TEXT PRIMARY KEY, attempt_count INTEGER NOT NULL,
      reset_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_id TEXT NOT NULL REFERENCES polysaccharide_records(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL, UNIQUE(user_id, record_id)
    );
    CREATE TABLE IF NOT EXISTS saved_searches (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, query_params TEXT NOT NULL, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS record_attachments (
      id TEXT PRIMARY KEY, record_id TEXT NOT NULL REFERENCES polysaccharide_records(id) ON DELETE RESTRICT,
      object_key TEXT NOT NULL UNIQUE, original_filename TEXT NOT NULL, mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL CHECK(byte_size>0), description TEXT NOT NULL DEFAULT '',
      is_public INTEGER NOT NULL DEFAULT 0, rights_confirmed_at TEXT NOT NULL,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL, deleted_at TEXT, deleted_by TEXT,
      slot_number INTEGER NOT NULL CHECK(slot_number BETWEEN 1 AND 10),
      upload_status TEXT NOT NULL CHECK(upload_status IN ('pending','ready'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS attachment_slots
      ON record_attachments(record_id,slot_number) WHERE deleted_at IS NULL;
    CREATE TABLE IF NOT EXISTS cos_cleanup_jobs (
      id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('pending','processing','completed','failed')) DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0, last_error TEXT,
      next_attempt_at TEXT NOT NULL, locked_until TEXT, alert_required INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cos_cleanup_due ON cos_cleanup_jobs(status,next_attempt_at);
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY, filename TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('previewing','invalid','ready','imported','failed')),
      total_rows INTEGER NOT NULL DEFAULT 0, valid_rows INTEGER NOT NULL DEFAULT 0,
      error_rows INTEGER NOT NULL DEFAULT 0, conflict_rows INTEGER NOT NULL DEFAULT 0,
      warning_rows INTEGER NOT NULL DEFAULT 0, imported_rows INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS import_job_rows (
      id TEXT PRIMARY KEY, import_job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
      row_number INTEGER NOT NULL, record_id TEXT, row_data TEXT NOT NULL,
      errors TEXT NOT NULL DEFAULT '[]', conflicts TEXT NOT NULL DEFAULT '[]', warnings TEXT NOT NULL DEFAULT '[]',
      UNIQUE(import_job_id, row_number)
    );
    CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'system')),
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      changed_fields TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
      ON audit_logs (entity_type, entity_id, created_at DESC);
  `);
  const existingColumns = new Set(
    (database.prepare("PRAGMA table_info(polysaccharide_records)").all() as { name: string }[])
      .map(({ name }) => name),
  );
  for (const column of ["deleted_at", "deleted_by", "deletion_reason"]) {
    if (!existingColumns.has(column)) {
      database.exec(`ALTER TABLE polysaccharide_records ADD COLUMN "${column}" TEXT`);
    }
  }
  database.exec(`CREATE INDEX IF NOT EXISTS idx_records_deleted_at
    ON polysaccharide_records (deleted_at, sort_order DESC)`);
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

export function selectRecords(options: { includeDeleted?: boolean } = {}): PolysaccharideRecord[] {
  const rows = getDatabase()
    .prepare(`SELECT * FROM polysaccharide_records${
      options.includeDeleted ? "" : " WHERE deleted_at IS NULL"
    } ORDER BY sort_order DESC`)
    .all() as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

export function selectRecordById(
  id: string,
  options: { includeDeleted?: boolean } = {},
): PolysaccharideRecord | null {
  const row = getDatabase()
    .prepare(`SELECT * FROM polysaccharide_records WHERE id = ?${
      options.includeDeleted ? "" : " AND deleted_at IS NULL"
    }`)
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

export type AuditAction = "create" | "update" | "soft_delete" | "restore" | "import";

function insertAuditLog(
  database: Database.Database,
  actorId: string,
  action: AuditAction,
  entityId: string,
  changedFields: Record<string, unknown>,
) {
  database.prepare(`
    INSERT INTO audit_logs
      (id, actor_type, actor_id, action, entity_type, entity_id, changed_fields, created_at)
    VALUES (?, 'admin', ?, ?, 'polysaccharide_record', ?, ?, ?)
  `).run(randomUUID(), actorId, action, entityId, JSON.stringify(changedFields), new Date().toISOString());
}

export function insertRecordWithAudit(record: PolysaccharideRecord, actorId: string) {
  const database = getDatabase();
  const transaction = database.transaction(() => {
    const created = insertRecord(record);
    insertAuditLog(database, actorId, "create", record.id, {
      fields: Object.fromEntries(recordFieldKeys.map((key) => [key, true])),
    });
    return created;
  });
  return transaction.immediate();
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

export function updateRecordWithAudit(
  record: PolysaccharideRecord,
  actorId: string,
  changedFields: Record<string, unknown>,
) {
  const database = getDatabase();
  const transaction = database.transaction(() => {
    const updated = replaceRecord(record);
    if (!updated) return null;
    insertAuditLog(database, actorId, "update", record.id, changedFields);
    return updated;
  });
  return transaction.immediate();
}

export function softDeleteRecord(
  id: string,
  deletedBy: string,
  reason: string,
  expectedName: string,
) {
  const normalizedReason = validateDeletionReason(reason);
  const database = getDatabase();
  const transaction = database.transaction(() => {
    const row = database.prepare(
      "SELECT * FROM polysaccharide_records WHERE id = ? AND deleted_at IS NULL",
    ).get(id) as Record<string, unknown> | undefined;
    if (!row) throw new RecordLifecycleError("NOT_ACTIVE", "记录不存在或已被删除");
    if (String(row.standard_name) !== expectedName) {
      throw new RecordLifecycleError("NAME_MISMATCH", "确认名称与记录标准名称不一致");
    }
    const deletedAt = new Date().toISOString();
    database.prepare(`
      UPDATE polysaccharide_records
      SET deleted_at = ?, deleted_by = ?, deletion_reason = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(deletedAt, deletedBy, normalizedReason, id);
    insertAuditLog(database, deletedBy, "soft_delete", id, {
      deleted_at: deletedAt,
      deletion_reason: normalizedReason,
    });
    return rowToRecord(row);
  });
  return transaction.immediate();
}

export function restoreSqliteRecord(id: string, actorId: string) {
  const database = getDatabase();
  const transaction = database.transaction(() => {
    const row = database.prepare(
      "SELECT * FROM polysaccharide_records WHERE id = ? AND deleted_at IS NOT NULL",
    ).get(id) as Record<string, unknown> | undefined;
    if (!row) throw new RecordLifecycleError("NOT_DELETED", "记录不存在或不在回收站");
    database.prepare(`
      UPDATE polysaccharide_records
      SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL, updated_at = ?
      WHERE id = ? AND deleted_at IS NOT NULL
    `).run(new Date().toISOString(), id);
    insertAuditLog(database, actorId, "restore", id, { restored: true });
    return rowToRecord(row);
  });
  return transaction.immediate();
}

export type AuditLog = {
  id: string;
  actor_type: "admin" | "system";
  actor_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  changed_fields: Record<string, unknown>;
  created_at: string;
};

export function selectAuditLogs(entityId?: string): AuditLog[] {
  const rows = getDatabase().prepare(`
    SELECT * FROM audit_logs${entityId ? " WHERE entity_id = ?" : ""}
    ORDER BY created_at DESC, rowid DESC
  `).all(...(entityId ? [entityId] : [])) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    actor_type: String(row.actor_type) as AuditLog["actor_type"],
    actor_id: String(row.actor_id),
    action: String(row.action) as AuditAction,
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    changed_fields: JSON.parse(String(row.changed_fields)) as Record<string, unknown>,
    created_at: String(row.created_at),
  }));
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
