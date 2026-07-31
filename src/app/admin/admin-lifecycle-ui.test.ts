import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("后台记录生命周期界面", () => {
  it("后台导航提供回收站且没有永久删除入口", async () => {
    const shell = await readFile(new URL("../../components/AdminShell.tsx", import.meta.url), "utf8");
    expect(shell).toContain('href="/admin/trash"');
    expect(shell).not.toMatch(/永久删除|hardDelete/i);
  });

  it("编辑页提供名称二次确认与删除原因", async () => {
    const panel = await readFile(new URL("../../components/AdminDeleteRecordPanel.tsx", import.meta.url), "utf8");
    expect(panel).toContain('name="expectedName"');
    expect(panel).toContain('name="reason"');
    expect(panel).toContain("完整标准名称");
  });

  it("回收站使用包含已删除记录的后台读取并支持恢复", async () => {
    const page = await readFile(new URL("./(protected)/trash/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("getRecordsIncludingDeleted");
    expect(page).toContain("RestoreRecordButton");
    expect(page).not.toMatch(/永久删除|hardDelete/i);
  });
});
