import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { buildPostgresPoolConfig } from "../src/lib/postgres-config";

function postgresErrorCode(error: unknown) {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

async function rollbackQuietly(client: { query: (sql: string) => Promise<unknown> }) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // The connection may not currently have an open transaction.
  }
}

async function main() {
  const testUrl = process.env.TEST_POSTGRES_DATABASE_URL?.trim();
  if (!testUrl) throw new Error("TEST_POSTGRES_DATABASE_URL is required");

  const pool = new Pool(buildPostgresPoolConfig({
    ...process.env,
    DATABASE_URL: testUrl,
  }));
  const lockHolder = await pool.connect();
  const contender = await pool.connect();
  const recordId = `integration-${randomUUID()}`;
  try {
    const inserted = await lockHolder.query<{ sort_order: string }>(`
      INSERT INTO polysaccharide_records (id, created_at, updated_at)
      VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING sort_order::text
    `, [recordId]);
    if (!inserted.rows[0]?.sort_order) throw new Error("sort_order default was not applied");

    await lockHolder.query("BEGIN");
    await lockHolder.query(
      "SELECT id FROM polysaccharide_records WHERE id = $1 FOR UPDATE",
      [recordId],
    );

    await contender.query("BEGIN");
    await contender.query("SET LOCAL lock_timeout = '250ms'");
    try {
      await contender.query(
        "UPDATE polysaccharide_records SET standard_name = $1 WHERE id = $2",
        ["must be blocked", recordId],
      );
      throw new Error("Concurrent update was not blocked by SELECT FOR UPDATE");
    } catch (error) {
      if (postgresErrorCode(error) !== "55P03") throw error;
      await contender.query("ROLLBACK");
    }

    await lockHolder.query("COMMIT");
    await contender.query("BEGIN");
    const afterRelease = await contender.query(
      "UPDATE polysaccharide_records SET standard_name = $1 WHERE id = $2",
      ["released lock", recordId],
    );
    if (afterRelease.rowCount !== 1) {
      throw new Error("Update did not succeed after the released lock");
    }
    await contender.query("ROLLBACK");

    await lockHolder.query("BEGIN");
    const email = `integration-${randomUUID()}@example.invalid`;
    await lockHolder.query(
      "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
      [randomUUID(), email, "test-only"],
    );
    await lockHolder.query("SAVEPOINT email_uniqueness_check");
    try {
      await lockHolder.query(
        "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
        [randomUUID(), email.toUpperCase(), "test-only"],
      );
      throw new Error("UNIQUE(LOWER(email)) was not enforced");
    } catch (error) {
      if (postgresErrorCode(error) !== "23505") throw error;
      await lockHolder.query("ROLLBACK TO SAVEPOINT email_uniqueness_check");
    }
    await lockHolder.query("ROLLBACK");
    process.stdout.write(
      "PostgreSQL sequence, two-connection row lock, and email checks passed.\n",
    );
  } finally {
    await rollbackQuietly(lockHolder);
    await rollbackQuietly(contender);
    await pool.query("DELETE FROM polysaccharide_records WHERE id = $1", [recordId]);
    lockHolder.release();
    contender.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
