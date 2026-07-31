import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("公开界面中文化", () => {
  it("页面语言和元数据使用中文", () => {
    const source = readSource("src/app/layout.tsx");

    expect(source).toContain('lang="zh-CN"');
    expect(source).toContain('title: "多糖科研数据库"');
  });

  it("关键公开页面不再使用旧英文操作文案", () => {
    const source = [
      "src/app/page.tsx",
      "src/app/database/page.tsx",
      "src/app/quality/page.tsx",
      "src/app/records/[id]/page.tsx",
      "src/components/SiteHeader.tsx",
      "src/components/RecordFilters.tsx",
      "src/components/RecordDetailSections.tsx",
      "src/components/QualityBadge.tsx",
    ].map(readSource).join("\n");

    for (const phrase of [
      "Search the database",
      "Browse and filter",
      "Data Dictionary",
      "Quality Dashboard",
      "Back to database",
      "Reset filters",
      "Open source",
      "Not recorded",
    ]) {
      expect(source).not.toContain(phrase);
    }
  });

  it("主导航不再展示数据字典", () => {
    const source = readSource("src/components/SiteHeader.tsx");
    expect(source).not.toContain("数据字典");
    expect(source).not.toContain("/dictionary");
  });

  it("前台检索区提供核心与高级科研筛选", () => {
    const source = readSource("src/components/RecordFilters.tsx");

    expect(source).toContain("名称、物种、活性、单糖组成或 DOI");
    expect(source).toContain("活性类别");
    expect(source).toContain("来源物种");
    expect(source).toContain("发表年份");
    expect(source).toContain("高级筛选");
    expect(source).toContain("来源类别");
    expect(source).toContain("证据等级");
    expect(source).toContain("结构完整度");
    expect(source).not.toContain("<span>实验类型</span>");
    expect(source).not.toContain("<span>单糖组成</span>");
  });

  it("无效地址显示中文空状态", () => {
    const source = readSource("src/app/not-found.tsx");

    expect(source).toContain("页面未找到");
    expect(source).toContain("返回多糖数据库");
  });
});
