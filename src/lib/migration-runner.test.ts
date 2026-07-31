import { describe, expect, it } from "vitest";

import {
  assertMigrationHistory,
  buildMigrationPlan,
  hashMigration,
  normalizeMigrationSql,
  runMigrations,
  type MigrationFile,
} from "./migration-runner";

const files: MigrationFile[] = [
  { version: "0001", name: "0001_initial.sql", sql: "BEGIN;\nCREATE TABLE first_table(id int);\nCOMMIT;", hash: "hash-1" },
  { version: "0002", name: "0002_users.sql", sql: "BEGIN;\nCREATE TABLE users(id int);\nCOMMIT;", hash: "hash-2" },
];

describe("migration runner", () => {
  it("hashes LF, CRLF, and CR migration files identically", () => {
    expect(hashMigration("BEGIN;\nSELECT 1;\nCOMMIT;\n")).toBe(
      hashMigration("BEGIN;\r\nSELECT 1;\r\nCOMMIT;\r\n"),
    );
    expect(hashMigration("BEGIN;\rSELECT 1;\rCOMMIT;\r")).toBe(
      hashMigration("BEGIN;\nSELECT 1;\nCOMMIT;\n"),
    );
  });
  it("plans unapplied migrations strictly in numeric order", () => {
    expect(buildMigrationPlan(files, [{ version: "0001", name: files[0].name, hash: "hash-1" }]))
      .toEqual([files[1]]);
  });

  it("rejects a changed migration that was already applied", () => {
    expect(() => assertMigrationHistory(files, [
      { version: "0001", name: files[0].name, hash: "different" },
    ])).toThrow(/hash|篡改/i);
  });

  it("rejects an applied history with a missing earlier version", () => {
    expect(() => buildMigrationPlan(files, [
      { version: "0002", name: files[1].name, hash: "hash-2" },
    ])).toThrow(/连续|0001|history/i);
  });

  it("rejects missing, duplicate, or non-contiguous migration versions", () => {
    expect(() => buildMigrationPlan([files[1]], [])).toThrow(/0001|顺序/i);
    expect(() => buildMigrationPlan([files[0], { ...files[1], version: "0001" }], []))
      .toThrow(/重复|duplicate/i);
  });

  it("removes only the outer transaction so runner can record the hash atomically", () => {
    expect(normalizeMigrationSql(files[0].sql)).toBe("CREATE TABLE first_table(id int);");
  });

  it("rolls back a failed migration and always releases the advisory lock", async () => {
    const client = new FakeMigrationClient({ failSql: "CREATE TABLE first_table" });
    await expect(runMigrations(client, files)).rejects.toThrow("injected failure");
    expect(client.events).toContain("ROLLBACK");
    expect(client.events.at(-1)).toContain("pg_advisory_unlock");
    expect(client.applied).toEqual([]);
  });

  it("rolls back migration effects when recording history fails", async () => {
    const client = new FakeMigrationClient({ failSql: "INSERT INTO schema_migrations" });
    await expect(runMigrations(client, files)).rejects.toThrow("injected failure");
    expect(client.created).toEqual([]);
    expect(client.applied).toEqual([]);
    expect(client.events).toContain("ROLLBACK");
  });

  it("does not reapply committed migrations when retried", async () => {
    const client = new FakeMigrationClient();
    await expect(runMigrations(client, files)).resolves.toEqual({
      applied: [files[0].name, files[1].name], pending: 0,
    });
    const migrationExecutions = client.events.filter(
      (event) => event.startsWith("CREATE TABLE") && !event.includes("schema_migrations"),
    );
    await expect(runMigrations(client, files)).resolves.toEqual({ applied: [], pending: 0 });
    expect(client.events.filter(
      (event) => event.startsWith("CREATE TABLE") && !event.includes("schema_migrations"),
    )).toEqual(migrationExecutions);
  });

  it("releases the advisory lock when history validation fails", async () => {
    const client = new FakeMigrationClient();
    client.applied.push({ version: "0001", name: files[0].name, hash: "tampered" });
    await expect(runMigrations(client, files)).rejects.toThrow(/hash/i);
    expect(client.events.at(-1)).toContain("pg_advisory_unlock");
  });
});

class FakeMigrationClient {
  events: string[] = [];
  applied: { version: string; name: string; hash: string }[] = [];
  created: string[] = [];
  private snapshot?: {
    applied: { version: string; name: string; hash: string }[];
    created: string[];
  };

  constructor(private readonly options: { failSql?: string } = {}) {}

  async query(sql: string, values: unknown[] = []) {
    const normalized = sql.trim();
    this.events.push(normalized);
    if (this.options.failSql && normalized.includes(this.options.failSql)) {
      throw new Error("injected failure");
    }
    if (normalized === "BEGIN") {
      this.snapshot = { applied: structuredClone(this.applied), created: [...this.created] };
    } else if (normalized === "ROLLBACK" && this.snapshot) {
      this.applied = this.snapshot.applied;
      this.created = this.snapshot.created;
      this.snapshot = undefined;
    } else if (normalized === "COMMIT") {
      this.snapshot = undefined;
    } else if (normalized.startsWith("SELECT version")) {
      return { rows: structuredClone(this.applied) };
    } else if (normalized.startsWith("INSERT INTO schema_migrations")) {
      this.applied.push({ version: String(values[0]), name: String(values[1]), hash: String(values[2]) });
    } else if (normalized.startsWith("CREATE TABLE") && !normalized.includes("schema_migrations")) {
      this.created.push(normalized);
    }
    return { rows: [] };
  }
}
