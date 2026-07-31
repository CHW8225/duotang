import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FIELD_DEFINITIONS } from "./fields";

const migrationPath = join(
  process.cwd(),
  "migrations",
  "postgres",
  "0001_initial_schema.sql",
);

describe("PostgreSQL initial migration", () => {
  it("defines all scientific fields and soft-delete metadata", async () => {
    const sql = await readFile(migrationPath, "utf8");

    for (const { key } of FIELD_DEFINITIONS) {
      expect(sql).toMatch(new RegExp(`\\b${key}\\b`, "i"));
    }
    expect(sql).toMatch(/deleted_at\s+TIMESTAMPTZ/i);
    expect(sql).toMatch(/deleted_by\s+TEXT/i);
    expect(sql).toMatch(/deletion_reason\s+TEXT/i);
  });

  it("creates every planned relational table", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const tables = [
      "polysaccharide_records",
      "users",
      "user_sessions",
      "admin_sessions",
      "email_tokens",
      "favorites",
      "saved_searches",
      "record_attachments",
      "import_jobs",
      "import_job_rows",
      "audit_logs",
    ];

    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table}\\b`, "i"));
    }
  });

  it("enforces identity, ownership, and uniqueness constraints", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(/users[\s\S]*email\s+TEXT\s+NOT NULL\s+UNIQUE/i);
    expect(sql).toMatch(/favorites[\s\S]*UNIQUE\s*\(user_id,\s*record_id\)/i);
    expect(sql).toMatch(/user_sessions[\s\S]*REFERENCES users\s*\(id\)/i);
    expect(sql).toMatch(/record_attachments[\s\S]*REFERENCES polysaccharide_records\s*\(id\)/i);
    expect(sql).toMatch(/import_job_rows[\s\S]*REFERENCES import_jobs\s*\(id\)/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX\s+[^;]*LOWER\s*\(email\)/i);
  });

  it("uses a PostgreSQL sequence for atomic record ordering", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(/CREATE SEQUENCE polysaccharide_record_sort_order_seq/i);
    expect(sql).toMatch(
      /sort_order\s+BIGINT\s+NOT NULL\s+DEFAULT\s+nextval\s*\(\s*'polysaccharide_record_sort_order_seq'/i,
    );
  });
});
