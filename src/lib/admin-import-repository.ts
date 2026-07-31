import { randomUUID } from "node:crypto";

import { computeQualityFlags } from "./quality";
import { resolveDatabaseBackend } from "./db";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import { normalizeImportDoi, type ParsedImportRow } from "./admin-import";
import { getDatabase } from "./sqlite";
import { getPostgresPool, withPostgresDataWriteLock, withPostgresTransaction, type PostgresQueryExecutor } from "./postgres";

export class ImportConflictError extends Error {}
export class ImportStateError extends Error {}

export type ImportJobRow = ParsedImportRow & { id: string; conflicts: string[] };
export type ImportJob = {
  id: string; filename: string; status: "invalid" | "ready" | "imported" | "failed";
  totalRows: number; validRows: number; errorRows: number; conflictRows: number;
  warningRows: number; importedRows: number; createdBy: string; createdAt: string;
  completedAt: string | null; rows: ImportJobRow[];
};

function classify(rows: ParsedImportRow[], existing: Array<{ upload_id: string; doi: string }>) {
  const idCounts = new Map<string, number>();
  const doiCounts = new Map<string, number>();
  rows.forEach(({ rowData }) => {
    const id = String(rowData.upload_id ?? "").trim();
    const doi = normalizeImportDoi(String(rowData.doi ?? ""));
    if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    if (doi) doiCounts.set(doi, (doiCounts.get(doi) ?? 0) + 1);
  });
  const existingIds = new Set(existing.map(({ upload_id }) => upload_id.trim()).filter(Boolean));
  const existingDois = new Set(existing.map(({ doi }) => normalizeImportDoi(doi)).filter(Boolean));
  return rows.map((row) => {
    const conflicts: string[] = [];
    const id = String(row.rowData.upload_id ?? "").trim();
    const doi = normalizeImportDoi(String(row.rowData.doi ?? ""));
    if (id && existingIds.has(id)) conflicts.push("上传编号已存在于数据库");
    if (doi && existingDois.has(doi)) conflicts.push("DOI 已存在于数据库");
    if (id && (idCounts.get(id) ?? 0) > 1) conflicts.push("上传编号在本批次重复");
    if (doi && (doiCounts.get(doi) ?? 0) > 1) conflicts.push("DOI 在本批次重复");
    return { ...row, id: randomUUID(), conflicts };
  });
}

function summarize(id: string, filename: string, actor: string, createdAt: string, rows: ImportJobRow[]): ImportJob {
  const errorRows = rows.filter(({ errors }) => errors.length).length;
  const conflictRows = rows.filter(({ conflicts }) => conflicts.length).length;
  const validRows = rows.filter(({ errors, conflicts }) => !errors.length && !conflicts.length).length;
  return { id, filename, status: errorRows || conflictRows ? "invalid" : "ready", totalRows: rows.length, validRows, errorRows, conflictRows, warningRows: rows.filter(({ warnings }) => warnings.length).length, importedRows: 0, createdBy: actor, createdAt, completedAt: null, rows };
}

function sqliteExisting() {
  return getDatabase().prepare("SELECT upload_id, doi FROM polysaccharide_records").all() as Array<{ upload_id: string; doi: string }>;
}

function persistSqlite(job: ImportJob) {
  const db = getDatabase();
  db.transaction(() => {
    db.prepare(`INSERT INTO import_jobs (id,filename,status,total_rows,valid_rows,error_rows,conflict_rows,warning_rows,imported_rows,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(job.id, job.filename, job.status, job.totalRows, job.validRows, job.errorRows, job.conflictRows, job.warningRows, 0, job.createdBy, job.createdAt);
    const insert = db.prepare("INSERT INTO import_job_rows (id,import_job_id,row_number,record_id,row_data,errors,conflicts,warnings) VALUES (?,?,?,?,?,?,?,?)");
    job.rows.forEach((row) => insert.run(row.id, job.id, row.rowNumber, row.rowData.upload_id || null, JSON.stringify(row.rowData), JSON.stringify(row.errors), JSON.stringify(row.conflicts), JSON.stringify(row.warnings)));
  }).immediate();
}

export async function createImportPreview(filename: string, actor: string, rows: ParsedImportRow[]) {
  await cleanupExpiredImportJobs();
  if (resolveDatabaseBackend() === "postgres") return createPostgresPreview(filename, actor, rows);
  const job = summarize(randomUUID(), filename, actor, new Date().toISOString(), classify(rows, sqliteExisting()));
  persistSqlite(job);
  return job;
}

function storedJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

export function mapStoredImportJob(job: Record<string, unknown>, rows: Array<Record<string, unknown>>): ImportJob {
  return { id: String(job.id), filename: String(job.filename), status: String(job.status) as ImportJob["status"], totalRows: Number(job.total_rows), validRows: Number(job.valid_rows), errorRows: Number(job.error_rows), conflictRows: Number(job.conflict_rows), warningRows: Number(job.warning_rows), importedRows: Number(job.imported_rows), createdBy: String(job.created_by), createdAt: String(job.created_at), completedAt: job.completed_at ? new Date(String(job.completed_at)).toISOString() : null, rows: rows.map((row) => ({ id: String(row.id), rowNumber: Number(row.row_number), rowData: storedJson<Record<string, string>>(row.row_data), record: null, errors: storedJson<string[]>(row.errors), conflicts: storedJson<string[]>(row.conflicts), warnings: storedJson<string[]>(row.warnings) })) };
}

export async function getImportJob(id: string): Promise<ImportJob | null> {
  if (resolveDatabaseBackend() === "postgres") return getPostgresJob(id);
  const db = getDatabase(); const job = db.prepare("SELECT * FROM import_jobs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!job) return null;
  return mapStoredImportJob(job, db.prepare("SELECT * FROM import_job_rows WHERE import_job_id = ? ORDER BY row_number").all(id) as Array<Record<string, unknown>>);
}

function buildRecord(rowData: Record<string, string>, index: number): PolysaccharideRecord {
  const now = new Date().toISOString();
  const base = Object.fromEntries(FIELD_DEFINITIONS.map(({ key }) => [key, key === "publication_year" ? (rowData[key] ? Number(rowData[key]) : null) : rowData[key] ?? ""])) as unknown as PolysaccharideRecord;
  const record: PolysaccharideRecord = { ...base, id: `poly-${Date.now()}-${index}-${randomUUID().slice(0, 8)}`, data_quality_flags: [], created_at: now, updated_at: now };
  record.data_quality_flags = computeQualityFlags(record, new Date().getFullYear()); return record;
}

export async function insertPostgresImportRecords(
  client: PostgresQueryExecutor,
  rowDataList: Array<Record<string, string>>,
) {
  const columns = ["id", ...FIELD_DEFINITIONS.map(({ key }) => key), "data_quality_flags", "created_at", "updated_at"];
  for (const [index, rowData] of rowDataList.entries()) {
    const record = buildRecord(rowData, index);
    await client.query(
      `INSERT INTO polysaccharide_records (${columns.map((column) => `"${column}"`).join(",")}, sort_order)
       VALUES (${columns.map((_, valueIndex) => `$${valueIndex + 1}`).join(",")}, nextval('polysaccharide_record_sort_order_seq'))`,
      columns.map((key) => record[key as keyof PolysaccharideRecord]),
    );
  }
}

export async function confirmImportJob(id: string, actor: string) {
  if (resolveDatabaseBackend() === "postgres") return confirmPostgresJob(id, actor);
  const db = getDatabase();
  return db.transaction(() => {
    const raw = db.prepare("SELECT * FROM import_jobs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!raw) throw new ImportStateError("导入任务不存在");
    if (raw.status === "imported") throw new ImportStateError("该导入任务已确认，不能重复执行");
    if (raw.status !== "ready") throw new ImportStateError("当前预览包含错误或冲突，不能确认");
    const storedRows = db.prepare("SELECT * FROM import_job_rows WHERE import_job_id = ? ORDER BY row_number").all(id) as Array<Record<string, unknown>>;
    const parsed = storedRows.map((r) => ({ rowNumber: Number(r.row_number), rowData: JSON.parse(String(r.row_data)), record: null, errors: JSON.parse(String(r.errors)), warnings: JSON.parse(String(r.warnings)) })) as ParsedImportRow[];
    const rechecked = classify(parsed, sqliteExisting());
    if (rechecked.some(({ conflicts }) => conflicts.length)) {
      db.prepare("UPDATE import_jobs SET status='invalid', conflict_rows=? WHERE id=?").run(rechecked.filter(({ conflicts }) => conflicts.length).length, id);
      throw new ImportConflictError("数据库已发生变化，请重新上传并预览");
    }
    const max = db.prepare("SELECT COALESCE(MAX(sort_order),0) value FROM polysaccharide_records").get() as { value: number };
    const columns = ["id", ...FIELD_DEFINITIONS.map(({ key }) => key), "data_quality_flags", "created_at", "updated_at"];
    const insert = db.prepare(`INSERT INTO polysaccharide_records (${columns.map((c) => `"${c}"`).join(",")},sort_order) VALUES (${columns.map(() => "?").join(",")},?)`);
    rechecked.forEach(({ rowData }, index) => { const record = buildRecord(rowData, index); insert.run(...columns.map((key) => key === "data_quality_flags" ? JSON.stringify(record.data_quality_flags) : record[key as keyof PolysaccharideRecord]), max.value + index + 1); });
    const completed = new Date().toISOString();
    db.prepare("UPDATE import_jobs SET status='imported', imported_rows=?, completed_at=? WHERE id=? AND status='ready'").run(rechecked.length, completed, id);
    db.prepare("INSERT INTO audit_logs (id,actor_type,actor_id,action,entity_type,entity_id,changed_fields,created_at) VALUES (?,'admin',?,'import','import_job',?,?,?)").run(randomUUID(), actor, id, JSON.stringify({ imported_rows: rechecked.length }), completed);
    return { importedRows: rechecked.length };
  }).immediate();
}

async function createPostgresPreview(filename: string, actor: string, rows: ParsedImportRow[]) {
  const existing = (await getPostgresPool().query("SELECT upload_id, doi FROM polysaccharide_records")).rows as Array<{ upload_id: string; doi: string }>;
  const job = summarize(randomUUID(), filename, actor, new Date().toISOString(), classify(rows, existing));
  await withPostgresTransaction(async (client) => {
    await client.query("INSERT INTO import_jobs (id,filename,status,total_rows,valid_rows,error_rows,conflict_rows,warning_rows,imported_rows,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10)", [job.id, filename, job.status, job.totalRows, job.validRows, job.errorRows, job.conflictRows, job.warningRows, actor, job.createdAt]);
    for (const row of job.rows) await client.query("INSERT INTO import_job_rows (id,import_job_id,row_number,record_id,row_data,errors,conflicts,warnings) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [row.id, job.id, row.rowNumber, row.rowData.upload_id || null, row.rowData, row.errors, row.conflicts, row.warnings]);
  }); return job;
}

async function getPostgresJob(id: string): Promise<ImportJob | null> {
  const pool = getPostgresPool(); const result = await pool.query("SELECT * FROM import_jobs WHERE id=$1", [id]); if (!result.rows[0]) return null;
  const rows = await pool.query("SELECT * FROM import_job_rows WHERE import_job_id=$1 ORDER BY row_number", [id]);
  return mapStoredImportJob(result.rows[0], rows.rows);
}

async function confirmPostgresJob(id: string, actor: string) {
  return withPostgresTransaction(async (client) => {
    return withPostgresDataWriteLock(client, async () => {
    const selected = await client.query("SELECT * FROM import_jobs WHERE id=$1 FOR UPDATE", [id]); const job = selected.rows[0];
    if (!job) throw new ImportStateError("导入任务不存在"); if (job.status === "imported") throw new ImportStateError("该导入任务已确认，不能重复执行"); if (job.status !== "ready") throw new ImportStateError("当前预览包含错误或冲突，不能确认");
    const stored = await client.query("SELECT * FROM import_job_rows WHERE import_job_id=$1 ORDER BY row_number", [id]);
    const existing = (await client.query("SELECT upload_id,doi FROM polysaccharide_records FOR SHARE")).rows as Array<{ upload_id: string; doi: string }>;
    const parsed = stored.rows.map((r) => ({ rowNumber: Number(r.row_number), rowData: r.row_data, record: null, errors: r.errors, warnings: r.warnings })) as ParsedImportRow[];
    const rows = classify(parsed, existing); if (rows.some((r) => r.conflicts.length)) throw new ImportConflictError("数据库已发生变化，请重新上传并预览");
    await insertPostgresImportRecords(client, rows.map(({ rowData }) => rowData));
    await client.query("UPDATE import_jobs SET status='imported',imported_rows=$2,completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='ready'", [id, rows.length]);
    await client.query("INSERT INTO audit_logs (id,actor_type,actor_id,action,entity_type,entity_id,changed_fields) VALUES ($1,'admin',$2,'import','import_job',$3,$4)", [randomUUID(), actor, id, { imported_rows: rows.length }]); return { importedRows: rows.length };
    });
  });
}

export async function listImportJobs() {
  if (resolveDatabaseBackend() === "postgres") { const result = await getPostgresPool().query("SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 100"); return Promise.all(result.rows.map((row) => getPostgresJob(String(row.id)))); }
  const ids = getDatabase().prepare("SELECT id FROM import_jobs ORDER BY created_at DESC LIMIT 100").all() as Array<{ id: string }>; return Promise.all(ids.map(({ id }) => getImportJob(id)));
}

export async function cleanupExpiredImportJobs(now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86400_000);
  if (resolveDatabaseBackend() === "postgres") {
    const result = await getPostgresPool().query(
      "DELETE FROM import_jobs WHERE created_at < $1 RETURNING id",
      [cutoff.toISOString()],
    );
    return { deletedJobs: result.rowCount ?? 0 };
  }
  const result = getDatabase().transaction(() =>
    getDatabase().prepare("DELETE FROM import_jobs WHERE created_at < ?").run(cutoff.toISOString()),
  ).immediate();
  return { deletedJobs: result.changes };
}
