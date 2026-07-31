import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("real PostgreSQL integration entrypoint", () => {
  it("is isolated behind an explicit test database credential", async () => {
    const scriptPath = join(process.cwd(), "scripts", "verify-postgres-integration.ts");
    const source = await readFile(scriptPath, "utf8");

    expect(source).toMatch(/TEST_POSTGRES_DATABASE_URL/);
    expect(source).toMatch(/ROLLBACK/);
    expect(source).not.toMatch(/process\.env\.DATABASE_URL\s*\?\./);
    expect(source).toMatch(/lockHolder\s*=\s*await pool\.connect/);
    expect(source).toMatch(/contender\s*=\s*await pool\.connect/);
    expect(source).toMatch(/lock_timeout/i);
    expect(source).toMatch(/55P03/);
    expect(source).toMatch(/released lock/i);
    const documentation = await readFile(
      join(process.cwd(), "docs", "postgres-integration-testing.md"),
      "utf8",
    );
    expect(documentation).toMatch(/two independent connections/i);
    expect(documentation).toMatch(/release/i);
    await expect(
      access(join(process.cwd(), "docs", "postgres-integration-testing.md")),
    ).resolves.toBeUndefined();
  });
});
