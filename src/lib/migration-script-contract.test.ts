import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("PostgreSQL seed migration script", () => {
  it("reuses shared connection settings and advances the ordering sequence", async () => {
    const source = await readFile(
      join(process.cwd(), "scripts", "migrate-seed-to-postgres.ts"),
      "utf8",
    );

    expect(source).toMatch(/buildPostgresPoolConfig/);
    expect(source).toMatch(/setval\s*\(/i);
    expect(source).toMatch(/polysaccharide_record_sort_order_seq/);
    expect(source).toMatch(/to_char\s*\(/i);
    expect(source).toMatch(/column === "created_at" \|\| column === "updated_at"/);
  });
});
