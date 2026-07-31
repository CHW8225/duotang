import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import { buildPostgresPoolConfig } from "../src/lib/postgres-config";

const errorCode = (error: unknown) =>
  error instanceof Error && "code" in error ? String(error.code) : "";

async function rollback(client: PoolClient) {
  try {
    await client.query("ROLLBACK");
  } catch {}
}

async function expectLockTimeout(work: () => Promise<unknown>) {
  try {
    await work();
    throw new Error("concurrent lifecycle operation unexpectedly bypassed the row lock");
  } catch (error) {
    if (errorCode(error) !== "55P03") throw error;
  }
}

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    process.stdout.write("SKIP: TEST_DATABASE_URL is not configured; no PostgreSQL lifecycle checks were run.\n");
    return;
  }

  const pool = new Pool(buildPostgresPoolConfig({ ...process.env, DATABASE_URL: testUrl }));
  const firstConnection = await pool.connect();
  const secondConnection = await pool.connect();
  const recordId = `lifecycle-${randomUUID()}`;

  try {
    await pool.query(`
      INSERT INTO polysaccharide_records
        (id, standard_name, created_at, updated_at)
      VALUES ($1, 'Lifecycle integration record', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [recordId]);

    const types = await pool.query(`
      SELECT pg_typeof(deleted_at)::text AS deleted_at_type,
             pg_typeof(changed_fields)::text AS changed_fields_type
      FROM polysaccharide_records
      LEFT JOIN LATERAL (SELECT changed_fields FROM audit_logs LIMIT 1) audit_sample ON true
      WHERE id = $1
      LIMIT 1
    `, [recordId]);
    if (types.rowCount !== 1 || (
      types.rows[0].deleted_at_type !== "timestamp with time zone"
      || types.rows[0].changed_fields_type !== "jsonb"
    )) throw new Error("unexpected lifecycle database column types");

    await firstConnection.query("BEGIN");
    try {
      await firstConnection.query(`
        UPDATE polysaccharide_records
        SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 'integration', deletion_reason = 'rollback-check'
        WHERE id = $1
      `, [recordId]);
      await firstConnection.query(`
        INSERT INTO audit_logs
          (id, actor_type, actor_id, action, entity_type, entity_id, changed_fields)
        VALUES ($1, 'invalid_actor', 'integration', 'soft_delete', 'polysaccharide_record', $2, '{}'::jsonb)
      `, [randomUUID(), recordId]);
      throw new Error("invalid audit actor unexpectedly succeeded");
    } catch (error) {
      if (errorCode(error) !== "23514") throw error;
      await firstConnection.query("ROLLBACK");
    }
    const activeAfterRollback = await pool.query(
      "SELECT id FROM polysaccharide_records WHERE id = $1 AND deleted_at IS NULL",
      [recordId],
    );
    if (activeAfterRollback.rowCount !== 1) throw new Error("audit failure did not roll back soft delete");

    await firstConnection.query("BEGIN");
    await firstConnection.query(
      "SELECT id FROM polysaccharide_records WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [recordId],
    );
    await secondConnection.query("BEGIN");
    await secondConnection.query("SET LOCAL lock_timeout = '250ms'");
    await expectLockTimeout(() => secondConnection.query(
      "SELECT id FROM polysaccharide_records WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [recordId],
    ));
    await secondConnection.query("ROLLBACK");
    await firstConnection.query(`
      UPDATE polysaccharide_records
      SET deleted_at = CURRENT_TIMESTAMP, deleted_by = 'integration', deletion_reason = 'concurrency-check'
      WHERE id = $1 AND deleted_at IS NULL
    `, [recordId]);
    await firstConnection.query(`
      INSERT INTO audit_logs
        (id, actor_type, actor_id, action, entity_type, entity_id, changed_fields)
      VALUES ($1, 'admin', 'integration', 'soft_delete', 'polysaccharide_record', $2, '{}'::jsonb)
    `, [randomUUID(), recordId]);
    await firstConnection.query("COMMIT");

    await firstConnection.query("BEGIN");
    await firstConnection.query(
      "SELECT id FROM polysaccharide_records WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE",
      [recordId],
    );
    await secondConnection.query("BEGIN");
    await secondConnection.query("SET LOCAL lock_timeout = '250ms'");
    await expectLockTimeout(() => secondConnection.query(
      "SELECT id FROM polysaccharide_records WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE",
      [recordId],
    ));
    await secondConnection.query("ROLLBACK");
    await firstConnection.query(`
      UPDATE polysaccharide_records
      SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NOT NULL
    `, [recordId]);
    await firstConnection.query(`
      INSERT INTO audit_logs
        (id, actor_type, actor_id, action, entity_type, entity_id, changed_fields)
      VALUES ($1, 'admin', 'integration', 'restore', 'polysaccharide_record', $2, '{}'::jsonb)
    `, [randomUUID(), recordId]);
    await firstConnection.query("COMMIT");

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM polysaccharide_records WHERE id = $1 AND deleted_at IS NULL) AS active_count,
        (SELECT COUNT(*)::int FROM audit_logs WHERE entity_id = $1) AS audit_count
    `, [recordId]);
    if (result.rows[0].active_count !== 1 || result.rows[0].audit_count !== 2) {
      throw new Error("lifecycle final state or audit count is incorrect");
    }
    process.stdout.write("PostgreSQL lifecycle locks, audit rollback, restore, and type checks passed.\n");
  } finally {
    await rollback(firstConnection);
    await rollback(secondConnection);
    await pool.query("DELETE FROM audit_logs WHERE entity_id = $1", [recordId]);
    await pool.query("DELETE FROM polysaccharide_records WHERE id = $1", [recordId]);
    firstConnection.release();
    secondConnection.release();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write("PostgreSQL record lifecycle integration failed.\n");
  if (process.env.NODE_ENV !== "production") {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exitCode = 1;
});
