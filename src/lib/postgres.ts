import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";

import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import { buildPostgresPoolConfig } from "./postgres-config";
import type { StoredSessionData } from "./sqlite";
import { RecordLifecycleError, validateDeletionReason } from "./record-lifecycle";

type QueryOptions = { includeDeleted?: boolean };
type PostgresGlobal = typeof globalThis & { polysaccharidePool?: Pool };

const postgresGlobal = globalThis as PostgresGlobal;
export const POSTGRES_DATA_WRITE_LOCK_KEY = 2_026_080_1;
const scientificColumns = FIELD_DEFINITIONS.map(({ key }) => key);
const recordColumns = [
  "id",
  ...scientificColumns,
  "data_quality_flags",
  "created_at",
  "updated_at",
] as const;

export type PostgresQueryExecutor = {
  query: (sql: string, values?: unknown[]) => Promise<{
    rows: QueryResultRow[];
    rowCount: number | null;
  }>;
};

export function getPostgresPool() {
  if (!postgresGlobal.polysaccharidePool) {
    postgresGlobal.polysaccharidePool = new Pool(buildPostgresPoolConfig());
  }
  return postgresGlobal.polysaccharidePool;
}

export async function closePostgresConnection() {
  await postgresGlobal.polysaccharidePool?.end();
  delete postgresGlobal.polysaccharidePool;
}

export function buildSelectRecordsQuery(options: QueryOptions = {}) {
  return `SELECT * FROM polysaccharide_records${
    options.includeDeleted ? "" : " WHERE deleted_at IS NULL"
  } ORDER BY sort_order DESC`;
}

export function buildSelectRecordByIdQuery(options: QueryOptions = {}) {
  return `SELECT * FROM polysaccharide_records WHERE id = $1${
    options.includeDeleted ? "" : " AND deleted_at IS NULL"
  }`;
}

export function buildInsertAdminSessionQuery() {
  return `INSERT INTO admin_sessions (id, username, authenticated_at, expires_at)
    VALUES ($1, $2, $3, $4)`;
}

export function buildSelectAdminSessionQuery() {
  return `SELECT id, username, authenticated_at, expires_at
    FROM admin_sessions WHERE id = $1 AND expires_at > CURRENT_TIMESTAMP`;
}

export function mapPostgresRowToRecord(row: QueryResultRow): PolysaccharideRecord {
  const qualityFlags = Array.isArray(row.data_quality_flags)
    ? row.data_quality_flags
    : JSON.parse(String(row.data_quality_flags ?? "[]"));
  const deletionMetadata = Object.hasOwn(row, "deleted_at") ? {
    deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    deleted_by: row.deleted_by ? String(row.deleted_by) : null,
    deletion_reason: row.deletion_reason ? String(row.deletion_reason) : null,
  } : {};
  return {
    ...Object.fromEntries(scientificColumns.map((key) => [key, row[key]])),
    id: String(row.id),
    publication_year: row.publication_year === null ? null : Number(row.publication_year),
    data_quality_flags: qualityFlags as string[],
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    ...deletionMetadata,
  } as PolysaccharideRecord;
}

export async function selectPostgresRecords(options: QueryOptions = {}) {
  const result = await getPostgresPool().query(buildSelectRecordsQuery(options));
  return result.rows.map(mapPostgresRowToRecord);
}

export async function selectPostgresRecordById(id: string, options: QueryOptions = {}) {
  const result = await getPostgresPool().query(buildSelectRecordByIdQuery(options), [id]);
  return result.rows[0] ? mapPostgresRowToRecord(result.rows[0]) : null;
}

function recordValues(record: PolysaccharideRecord) {
  return recordColumns.map((column) => record[column]);
}

export async function insertPostgresRecord(record: PolysaccharideRecord) {
  return withPostgresTransaction((client) =>
    withPostgresDataWriteLock(client, async () => {
      await assertPostgresImportIdentityAvailable(client, record.upload_id, record.doi);
      return insertPostgresRecordWithClient(client, record);
    }),
  );
}

async function insertPostgresAuditLog(
  client: PostgresQueryExecutor,
  actorId: string,
  action: "create" | "update" | "soft_delete" | "restore",
  entityId: string,
  changedFields: Record<string, unknown>,
) {
  await client.query(`
    INSERT INTO audit_logs
      (id, actor_type, actor_id, action, entity_type, entity_id, changed_fields)
    VALUES ($1, 'admin', $2, $3, 'polysaccharide_record', $4, $5::jsonb)
  `, [randomUUID(), actorId, action, entityId, JSON.stringify(changedFields)]);
}

export function createPostgresRecordWithAudit(record: PolysaccharideRecord, actorId: string) {
  return withPostgresTransaction(async (client) => {
    return withPostgresDataWriteLock(client, async () => {
      await assertPostgresImportIdentityAvailable(client, record.upload_id, record.doi);
      const created = await insertPostgresRecordWithClient(client, record);
      await insertPostgresAuditLog(client, actorId, "create", record.id, {
        fields: Object.fromEntries(scientificColumns.map((key) => [key, true])),
      });
      return created;
    });
  });
}

export async function insertPostgresRecordWithClient(
  client: PostgresQueryExecutor,
  record: PolysaccharideRecord,
) {
  const columns = recordColumns.map((column) => `"${column}"`).join(", ");
  const placeholders = recordColumns.map((_, index) => `$${index + 1}`).join(", ");
  await client.query(
    `INSERT INTO polysaccharide_records (${columns}) VALUES (${placeholders})`,
    recordValues(record),
  );
  return record;
}

async function replacePostgresRecordWithClient(
  client: PostgresQueryExecutor,
  record: PolysaccharideRecord,
) {
  const mutableColumns = recordColumns.filter(
    (column) => column !== "id" && column !== "created_at",
  );
  const assignments = mutableColumns
    .map((column, index) => `"${column}" = $${index + 1}`)
    .join(", ");
  const values = mutableColumns.map((column) => record[column]);
  const result = await client.query(
    `UPDATE polysaccharide_records SET ${assignments}
     WHERE id = $${values.length + 1} AND deleted_at IS NULL`,
    [...values, record.id],
  );
  return result.rowCount === 1 ? record : null;
}

export async function updatePostgresRecordWithClient(
  client: PostgresQueryExecutor,
  id: string,
  update: (record: PolysaccharideRecord) => PolysaccharideRecord,
) {
  const selected = await client.query(
    "SELECT * FROM polysaccharide_records WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
    [id],
  );
  if (!selected.rows[0]) return null;
  return replacePostgresRecordWithClient(
    client,
    update(mapPostgresRowToRecord(selected.rows[0])),
  );
}

export async function updatePostgresRecord(
  id: string,
  update: (record: PolysaccharideRecord) => PolysaccharideRecord,
) {
  const client = await getPostgresPool().connect();
  try {
    return await runPostgresRecordUpdate(client, id, update);
  } finally {
    client.release();
  }
}

export async function updatePostgresRecordWithAudit(
  id: string,
  update: (record: PolysaccharideRecord) => PolysaccharideRecord,
  actorId: string,
  changedFields: Record<string, unknown>,
) {
  return withPostgresTransaction(async (client) => {
    const updated = await updatePostgresRecordWithClient(client, id, update);
    if (updated) await insertPostgresAuditLog(client, actorId, "update", id, changedFields);
    return updated;
  });
}

export async function softDeletePostgresRecord(
  id: string,
  actorId: string,
  reason: string,
  expectedName: string,
) {
  const client = await getPostgresPool().connect();
  try {
    return await runPostgresSoftDelete(client, id, actorId, reason, expectedName);
  } finally {
    client.release();
  }
}

export async function runPostgresSoftDelete(
  client: PostgresQueryExecutor,
  id: string,
  actorId: string,
  reason: string,
  expectedName: string,
) {
  const normalizedReason = validateDeletionReason(reason);
  return await runPostgresTransaction(client, async () => {
    const selected = await client.query(
      "SELECT * FROM polysaccharide_records WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id],
    );
    if (!selected.rows[0]) throw new RecordLifecycleError("NOT_ACTIVE", "记录不存在或已被删除");
    if (String(selected.rows[0].standard_name) !== expectedName) {
      throw new RecordLifecycleError("NAME_MISMATCH", "确认名称与记录标准名称不一致");
    }
    const deletedAt = new Date().toISOString();
    await client.query(`
      UPDATE polysaccharide_records
      SET deleted_at = $1, deleted_by = $2, deletion_reason = $3
      WHERE id = $4 AND deleted_at IS NULL
    `, [deletedAt, actorId, normalizedReason, id]);
    await insertPostgresAuditLog(client, actorId, "soft_delete", id, {
      deleted_at: deletedAt,
      deletion_reason: normalizedReason,
    });
    return mapPostgresRowToRecord(selected.rows[0]);
  });
}

export async function restorePostgresRecord(id: string, actorId: string) {
  const client = await getPostgresPool().connect();
  try {
    return await runPostgresRestore(client, id, actorId);
  } finally {
    client.release();
  }
}

export function runPostgresRestore(
  client: PostgresQueryExecutor,
  id: string,
  actorId: string,
) {
  return runPostgresTransaction(client, async () => {
    const selected = await client.query(
      "SELECT * FROM polysaccharide_records WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE",
      [id],
    );
    if (!selected.rows[0]) throw new RecordLifecycleError("NOT_DELETED", "记录不存在或不在回收站");
    await client.query(`
      UPDATE polysaccharide_records
      SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NOT NULL
    `, [id]);
    await insertPostgresAuditLog(client, actorId, "restore", id, { restored: true });
    return mapPostgresRowToRecord(selected.rows[0]);
  });
}

export async function runPostgresTransaction<T>(
  client: PostgresQueryExecutor,
  work: () => Promise<T>,
) {
  await client.query("BEGIN");
  try {
    const result = await work();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export function runPostgresRecordUpdate(
  client: PostgresQueryExecutor,
  id: string,
  update: (record: PolysaccharideRecord) => PolysaccharideRecord,
) {
  return runPostgresTransaction(client, () =>
    updatePostgresRecordWithClient(client, id, update),
  );
}

export async function withPostgresTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPostgresPool().connect();
  try {
    return await runPostgresTransaction(client, () => work(client));
  } finally {
    client.release();
  }
}

export async function withPostgresDataWriteLock<T>(
  client: PostgresQueryExecutor,
  work: () => Promise<T>,
) {
  await client.query("SELECT pg_advisory_xact_lock($1)", [POSTGRES_DATA_WRITE_LOCK_KEY]);
  return work();
}

export async function assertPostgresImportIdentityAvailable(
  client: PostgresQueryExecutor,
  uploadId: string,
  doi: string,
) {
  const normalizedUploadId = uploadId.trim();
  const normalizedDoi = doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLowerCase();
  if (!normalizedUploadId && !normalizedDoi) return;
  const result = await client.query(`
    SELECT id FROM polysaccharide_records
    WHERE ($1 <> '' AND upload_id = $1)
       OR ($2 <> '' AND lower(regexp_replace(trim(doi), '^https?://(dx\\.)?doi\\.org/', '', 'i')) = $2)
    LIMIT 1
  `, [normalizedUploadId, normalizedDoi]);
  if (result.rowCount) throw new Error("上传编号或 DOI 与现有记录冲突");
}

export async function insertPostgresAdminSession(session: StoredSessionData) {
  await withPostgresTransaction(async (client) => {
    await client.query("DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP");
    await client.query(buildInsertAdminSessionQuery(), [
      session.id,
      session.username,
      session.authenticatedAt,
      session.expiresAt,
    ]);
  });
}

export async function selectPostgresAdminSession(
  id: string,
): Promise<StoredSessionData | null> {
  const result = await getPostgresPool().query(buildSelectAdminSessionQuery(), [id]);
  const row = result.rows[0];
  return row
    ? {
        id: String(row.id),
        username: String(row.username),
        authenticatedAt: new Date(row.authenticated_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString(),
      }
    : null;
}
