import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("管理后台中文化", () => {
  it("登录和认证错误使用中文", () => {
    const source = [
      "src/app/admin/login/page.tsx",
      "src/app/admin/login/LoginForm.tsx",
      "src/app/admin/login/actions.ts",
    ]
      .map(readSource)
      .join("\n");

    expect(source).toContain("管理员登录");
    expect(source).toContain("用户名或密码不正确");
    expect(source).not.toContain("Sign in");
  });

  it("记录管理页面不再使用旧英文操作文案", () => {
    const source = [
      "src/components/AdminShell.tsx",
      "src/components/AdminRecordForm.tsx",
      "src/app/admin/(protected)/page.tsx",
      "src/app/admin/(protected)/records/page.tsx",
      "src/app/admin/(protected)/records/new/page.tsx",
      "src/app/admin/(protected)/records/[id]/edit/page.tsx",
    ]
      .map(readSource)
      .join("\n");

    for (const phrase of ["New record", "Manage records", "Filter records", "Save changes", "Not recorded"]) {
      expect(source).not.toContain(phrase);
    }
  });

  it("动态字段标签使用中文且不改动底层键名", async () => {
    const { FIELD_DEFINITIONS } = await import("../../lib/fields");

    expect(FIELD_DEFINITIONS.find(({ key }) => key === "upload_id")?.label).toBe("上传编号");
    expect(FIELD_DEFINITIONS.find(({ key }) => key === "ref_id")?.label).toBe("文献编号");
  });

  it("内部页面名称不受可见文案检查误伤", () => {
    expect(readSource("src/app/admin/(protected)/page.tsx")).toContain(
      "function AdminDashboardPage",
    );
  });
});
