import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import records from "../data/import/polysaccharide-records.json";
import type { PolysaccharideRecord } from "../src/lib/fields";
import type { ParsedImportRow } from "../src/lib/admin-import";
import { buildPostgresPoolConfig } from "../src/lib/postgres-config";

async function main() {
const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testUrl) {
  process.stdout.write("SKIP: TEST_DATABASE_URL is not configured; no PostgreSQL admin import checks were run.\n");
  return;
}

process.env.DATABASE_URL = testUrl;
const { confirmImportJob, createImportPreview } = await import("../src/lib/admin-import-repository");
const { closePostgresConnection } = await import("../src/lib/postgres");
const pool = new Pool({ ...buildPostgresPoolConfig({ ...process.env, DATABASE_URL: testUrl }), max: 6 });
const firstConnection = await pool.connect();
const secondConnection = await pool.connect();
let probeConnectionsReleased = false;
const prefix = `pg-import-${randomUUID()}`;
const jobIds: string[] = [];
const functionName = `fail_import_audit_${randomUUID().replaceAll("-", "")}`;
const triggerName = `fail_import_audit_${randomUUID().replaceAll("-", "")}`;

function parsedRow(uploadId: string, doi: string, rowNumber = 2): ParsedImportRow {
  const source = records[0] as PolysaccharideRecord;
  const rowData = Object.fromEntries(Object.entries(source).filter(([key]) => !["id", "data_quality_flags", "created_at", "updated_at", "deleted_at", "deleted_by", "deletion_reason"].includes(key)).map(([key, value]) => [key, value === null ? "" : String(value)]));
  rowData.upload_id = uploadId;
  rowData.doi = doi;
  const record = { ...source, ...rowData, publication_year: source.publication_year };
  return { rowNumber, rowData, record, errors: [], warnings: [] };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  await firstConnection.query("SELECT 1");
  await secondConnection.query("SELECT 1");
  firstConnection.release();
  secondConnection.release();
  probeConnectionsReleased = true;

  const sharedUpload = `${prefix}-concurrent`;
  const sharedDoi = `10.9999/${prefix}-concurrent`;
  const first = await createImportPreview("first.xlsx", "integration", [parsedRow(sharedUpload, sharedDoi)]);
  const second = await createImportPreview("second.xlsx", "integration", [parsedRow(sharedUpload, sharedDoi)]);
  jobIds.push(first.id, second.id);
  const concurrent = await Promise.allSettled([
    confirmImportJob(first.id, "integration"),
    confirmImportJob(second.id, "integration"),
  ]);
  assert(concurrent.filter(({ status }) => status === "fulfilled").length === 1, "concurrent same ID/DOI imports did not allow exactly one batch");
  assert(concurrent.filter(({ status }) => status === "rejected").length === 1, "concurrent same ID/DOI imports did not reject exactly one batch");
  const inserted = await pool.query("SELECT id, pg_typeof(data_quality_flags)::text quality_type, data_quality_flags FROM polysaccharide_records WHERE upload_id=$1", [sharedUpload]);
  assert(inserted.rowCount === 1, "concurrent import inserted an unexpected number of records");
  assert(inserted.rows[0].quality_type === "jsonb" && Array.isArray(inserted.rows[0].data_quality_flags), "data_quality_flags is not valid jsonb");
  const successfulJob = concurrent[0].status === "fulfilled" ? first.id : second.id;
  await confirmImportJob(successfulJob, "integration").then(() => { throw new Error("import task confirmed more than once"); }, () => undefined);

  const insertFailureUpload = `${prefix}-insert-failure`;
  const insertFailure = await createImportPreview("insert-failure.xlsx", "integration", [parsedRow(insertFailureUpload, `10.9999/${prefix}-insert-failure`)]);
  jobIds.push(insertFailure.id);
  await pool.query("UPDATE import_job_rows SET row_data=jsonb_set(row_data, '{publication_year}', to_jsonb($2::text)) WHERE import_job_id=$1", [insertFailure.id, "999999999999999"]);
  await confirmImportJob(insertFailure.id, "integration").then(() => { throw new Error("invalid insert unexpectedly succeeded"); }, () => undefined);
  assert((await pool.query("SELECT id FROM polysaccharide_records WHERE upload_id=$1", [insertFailureUpload])).rowCount === 0, "insert failure did not roll back records");

  const auditFailureUpload = `${prefix}-audit-failure`;
  const auditFailure = await createImportPreview("audit-failure.xlsx", "integration", [parsedRow(auditFailureUpload, `10.9999/${prefix}-audit-failure`)]);
  jobIds.push(auditFailure.id);
  await pool.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='import' AND NEW.entity_id='${auditFailure.id}' THEN RAISE EXCEPTION 'audit failure'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
  await confirmImportJob(auditFailure.id, "integration").then(() => { throw new Error("audit failure unexpectedly committed"); }, () => undefined);
  assert((await pool.query("SELECT id FROM polysaccharide_records WHERE upload_id=$1", [auditFailureUpload])).rowCount === 0, "audit failure did not roll back records");
  const task = await pool.query("SELECT status, imported_rows FROM import_jobs WHERE id=$1", [auditFailure.id]);
  assert(task.rows[0]?.status === "ready" && Number(task.rows[0]?.imported_rows) === 0, "audit failure did not roll back task state");

  process.stdout.write("verified PostgreSQL concurrent import locking, rollback, JSONB quality flags, and one-time confirmation.\n");
} finally {
  if (!probeConnectionsReleased) {
    firstConnection.release();
    secondConnection.release();
  }
  await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON audit_logs`).catch(() => undefined);
  await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`).catch(() => undefined);
  await pool.query("DELETE FROM audit_logs WHERE entity_id = ANY($1::text[]) OR entity_id IN (SELECT id FROM polysaccharide_records WHERE upload_id LIKE $2)", [jobIds, `${prefix}%`]).catch(() => undefined);
  await pool.query("DELETE FROM polysaccharide_records WHERE upload_id LIKE $1", [`${prefix}%`]).catch(() => undefined);
  await pool.query("DELETE FROM import_jobs WHERE id = ANY($1::uuid[])", [jobIds]).catch(() => undefined);
  await pool.end();
  await closePostgresConnection();
}
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
