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
      "src/app/dictionary/page.tsx",
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

  it("保留结构与审核筛选能力并使用中文标签", () => {
    const source = readSource("src/components/RecordFilters.tsx");

    expect(source).toContain('["structure_completeness", "结构完整度"]');
    expect(source).toContain('["review_status", "审核状态"]');
  });
});
