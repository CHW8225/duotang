import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import { buildPostgresPoolConfig } from "./postgres-config";
import type { StoredSessionData } from "./sqlite";

type QueryOptions = { includeDeleted?: boolean };
type PostgresGlobal = typeof globalThis & { polysaccharidePool?: Pool };

const postgresGlobal = globalThis as PostgresGlobal;
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
  return {
    ...Object.fromEntries(scientificColumns.map((key) => [key, row[key]])),
    id: String(row.id),
    publication_year: row.publication_year === null ? null : Number(row.publication_year),
    data_quality_flags: qualityFlags as string[],
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
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
  return insertPostgresRecordWithClient(getPostgresPool(), record);
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
