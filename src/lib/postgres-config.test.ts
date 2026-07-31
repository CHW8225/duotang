import { describe, expect, it } from "vitest";

import { buildPostgresPoolConfig } from "./postgres-config";

describe("PostgreSQL connection configuration", () => {
  it("builds the shared Tencent Cloud pool configuration", () => {
    expect(buildPostgresPoolConfig({
      DATABASE_URL: "postgresql://private-host/database",
      POSTGRES_SSL: "require",
      POSTGRES_POOL_MAX: "7",
    })).toEqual({
      connectionString: "postgresql://private-host/database",
      ssl: { rejectUnauthorized: true },
      max: 7,
    });
  });

  it("supports private-network plaintext and rejects invalid settings", () => {
    expect(buildPostgresPoolConfig({
      DATABASE_URL: "postgresql://private-host/database",
      POSTGRES_SSL: "disable",
    })).toEqual({
      connectionString: "postgresql://private-host/database",
      ssl: undefined,
      max: 10,
    });
    expect(() => buildPostgresPoolConfig({ POSTGRES_SSL: "disable" })).toThrow(
      /DATABASE_URL is required/,
    );
    expect(() => buildPostgresPoolConfig({
      DATABASE_URL: "postgresql://private-host/database",
      POSTGRES_SSL: "prefer",
    })).toThrow(/POSTGRES_SSL/);
  });
});
