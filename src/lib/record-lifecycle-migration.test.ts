import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("记录删除原因数据库约束", () => {
  it("0005 migration 在数据库层限制删除原因长度为 1 到 500", async () => {
    const sql = await readFile(
      join(process.cwd(), "migrations", "postgres", "0005_deletion_reason_length.sql"),
      "utf8",
    );
    expect(sql).toMatch(/CHECK\s*\([\s\S]*deletion_reason IS NULL[\s\S]*char_length\(deletion_reason\)[\s\S]*BETWEEN 1 AND 500[\s\S]*\)/i);
  });
});
