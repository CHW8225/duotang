import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";

import { loadMigrationFiles, readAppliedMigrations, runMigrations } from "../src/lib/migration-runner";
import { buildPostgresPoolConfig } from "../src/lib/postgres-config";

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    process.stdout.write("SKIP: TEST_DATABASE_URL is not configured; no PostgreSQL migration checks were run.\n");
    return;
  }
  const schema = `migration_test_${randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({
    ...buildPostgresPoolConfig({ ...process.env, DATABASE_URL: testUrl }),
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const files = await loadMigrationFiles(resolve("migrations/postgres"));
    const first = await runMigrations(client, files);
    if (first.applied.length !== files.length) throw new Error("Not all migrations were applied");
    const history = await readAppliedMigrations(client);
    if (history.length !== files.length) throw new Error("Migration history count mismatch");
    const retry = await runMigrations(client, files);
    if (retry.applied.length !== 0) throw new Error("Committed migrations were reapplied");
    process.stdout.write(`PASS: applied and retried ${files.length} PostgreSQL migrations.\n`);
  } finally {
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
