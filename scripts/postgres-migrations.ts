import { resolve } from "node:path";
import { Pool } from "pg";

import { buildPostgresPoolConfig } from "../src/lib/postgres-config";
import {
  buildMigrationPlan,
  loadMigrationFiles,
  readAppliedMigrations,
  runMigrations,
} from "../src/lib/migration-runner";

async function main() {
  const command = process.argv[2];
  if (command !== "migrate" && command !== "status") {
    throw new Error("Usage: tsx scripts/postgres-migrations.ts <migrate|status>");
  }
  const files = await loadMigrationFiles(resolve("migrations/postgres"));
  const pool = new Pool({ ...buildPostgresPoolConfig(), max: 1 });
  const client = await pool.connect();
  try {
    if (command === "migrate") {
      const result = await runMigrations(client, files);
      process.stdout.write(result.applied.length
        ? `Applied: ${result.applied.join(", ")}\n`
        : "Database is up to date.\n");
    } else {
      const applied = await readAppliedMigrations(client);
      const pending = buildMigrationPlan(files, applied);
      process.stdout.write(`Applied ${applied.length}/${files.length}; pending ${pending.length}.\n`);
      pending.forEach(({ name }) => process.stdout.write(`PENDING ${name}\n`));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
