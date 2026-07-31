import type { PoolConfig } from "pg";

type PostgresEnvironment = Record<string, string | undefined>;

export function buildPostgresPoolConfig(
  environment: PostgresEnvironment = process.env,
): PoolConfig {
  const connectionString = environment.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL");

  const sslMode = environment.POSTGRES_SSL?.trim() || "disable";
  if (sslMode !== "disable" && sslMode !== "require") {
    throw new Error("POSTGRES_SSL must be disable or require");
  }
  const max = Number(environment.POSTGRES_POOL_MAX || 10);
  if (!Number.isInteger(max) || max < 1) {
    throw new Error("POSTGRES_POOL_MAX must be a positive integer");
  }

  return {
    connectionString,
    ssl: sslMode === "require" ? { rejectUnauthorized: true } : undefined,
    max,
  };
}
