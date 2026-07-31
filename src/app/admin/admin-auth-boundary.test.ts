import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const protectedPages = [
  "src/app/admin/(protected)/page.tsx",
  "src/app/admin/(protected)/records/page.tsx",
  "src/app/admin/(protected)/records/new/page.tsx",
  "src/app/admin/(protected)/records/[id]/edit/page.tsx",
];

describe("后台页面鉴权边界", () => {
  it.each(protectedPages)("%s 在页面入口重新校验管理员会话", (path) => {
    const source = readFileSync(join(process.cwd(), path), "utf8");

    expect(source).toContain('import { requireAdmin } from "@/lib/auth"');
    expect(source).toContain("await requireAdmin()");
  });
});
