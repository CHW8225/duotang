import { describe, expect, it } from "vitest";

import records from "../../data/import/polysaccharide-records.json";
import type { PolysaccharideRecord } from "./fields";

import {
  buildInsertAdminSessionQuery,
  buildSelectAdminSessionQuery,
  buildSelectRecordByIdQuery,
  buildSelectRecordsQuery,
  insertPostgresRecordWithClient,
  mapPostgresRowToRecord,
  runPostgresTransaction,
  runPostgresRecordUpdate,
  updatePostgresRecordWithClient,
} from "./postgres";

describe("PostgreSQL record query policy", () => {
  it("excludes soft-deleted records from public list queries", () => {
    expect(buildSelectRecordsQuery()).toMatch(/WHERE deleted_at IS NULL/i);
  });

  it("excludes soft-deleted records from public detail queries", () => {
    expect(buildSelectRecordByIdQuery()).toMatch(
      /WHERE id = \$1 AND deleted_at IS NULL/i,
    );
  });

  it("allows administrative queries to include deleted records explicitly", () => {
    expect(buildSelectRecordsQuery({ includeDeleted: true })).not.toMatch(
      /deleted_at IS NULL/i,
    );
    expect(buildSelectRecordByIdQuery({ includeDeleted: true })).toMatch(
      /WHERE id = \$1(?![\s\S]*deleted_at IS NULL)/i,
    );
  });

  it("stores and retrieves unexpired administrator sessions", () => {
    expect(buildInsertAdminSessionQuery()).toMatch(/INSERT INTO admin_sessions/i);
    expect(buildSelectAdminSessionQuery()).toMatch(/expires_at > CURRENT_TIMESTAMP/i);
  });

  it("runs transaction statements in commit order and rolls back failures", async () => {
    const committed: string[] = [];
    const commitClient = {
      query: async (sql: string) => {
        committed.push(sql);
        return { rows: [], rowCount: 0 };
      },
    };
    await expect(runPostgresTransaction(commitClient, async () => "ok")).resolves.toBe("ok");
    expect(committed).toEqual(["BEGIN", "COMMIT"]);

    const rolledBack: string[] = [];
    const rollbackClient = {
      query: async (sql: string) => {
        rolledBack.push(sql);
        return { rows: [], rowCount: 0 };
      },
    };
    await expect(runPostgresTransaction(rollbackClient, async () => {
      throw new Error("write failed");
    })).rejects.toThrow("write failed");
    expect(rolledBack).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("locks a record before updating it in the same client transaction", async () => {
    const source = (records as PolysaccharideRecord[])[0];
    const calls: { sql: string; values?: unknown[] }[] = [];
    const client = {
      query: async (sql: string, values?: unknown[]) => {
        calls.push({ sql, values });
        if (/SELECT/i.test(sql)) return { rows: [source], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
    };

    const result = await updatePostgresRecordWithClient(
      client,
      source.id,
      (record) => ({ ...record, standard_name: "locked update" }),
    );

    expect(calls[0].sql).toMatch(/SELECT[\s\S]*FOR UPDATE/i);
    expect(calls[1].sql).toMatch(/^UPDATE polysaccharide_records/i);
    expect(result?.standard_name).toBe("locked update");
  });

  it("keeps lock and update inside one complete transaction sequence", async () => {
    const source = (records as PolysaccharideRecord[])[0];
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql);
        if (/SELECT[\s\S]*FOR UPDATE/i.test(sql)) return { rows: [source], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
    };

    await runPostgresRecordUpdate(client, source.id, (record) => record);

    expect(statements.map((sql) => sql.trim().split(/\s+/)[0])).toEqual([
      "BEGIN",
      "SELECT",
      "UPDATE",
      "COMMIT",
    ]);
  });

  it("uses the sequence default for inserts instead of MAX plus one", async () => {
    const source = (records as PolysaccharideRecord[])[0];
    const calls: string[] = [];
    const client = {
      query: async (sql: string) => {
        calls.push(sql);
        return { rows: [], rowCount: 1 };
      },
    };

    await insertPostgresRecordWithClient(client, source);

    expect(calls[0]).not.toMatch(/sort_order|MAX\s*\(/i);
  });

  it("maps PostgreSQL JSON and timestamp values to the public record shape", () => {
    const source = (records as PolysaccharideRecord[])[0];
    const mapped = mapPostgresRowToRecord({
      ...source,
      publication_year: String(source.publication_year),
      data_quality_flags: JSON.stringify(source.data_quality_flags),
      created_at: new Date(source.created_at),
      updated_at: new Date(source.updated_at),
    });

    expect(mapped).toEqual({
      ...source,
      created_at: new Date(source.created_at).toISOString(),
      updated_at: new Date(source.updated_at).toISOString(),
    });
  });
});
