import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PolysaccharideRecord } from "@/lib/fields";
import { RecordTable } from "./RecordTable";

const record = {
  id: "record-1",
  standard_name: "示例多糖",
  english_name: "Example polysaccharide",
  source_species: "Ganoderma lucidum",
  publication_year: 2024,
  activity_category: "抗氧化",
  evidence_level: "细胞实验",
  structure_completeness: "完整",
  review_status: "待审核",
  monosaccharide_standardized: "Glc:Gal:Man",
  monosaccharide_original: "glucose, galactose and mannose",
  monosaccharide_ratio: "4:2:1",
} as PolysaccharideRecord;

describe("RecordTable", () => {
  it("用单糖组成和组成比例替换结构与审核列", () => {
    const html = renderToStaticMarkup(<RecordTable records={[record]} />);

    expect(html).toContain("<th>单糖组成</th>");
    expect(html).toContain("<th>组成比例</th>");
    expect(html).not.toContain("<th>Structure</th>");
    expect(html).not.toContain("<th>Review</th>");
    expect(html).toContain('title="Glc:Gal:Man"');
    expect(html).toContain(">4:2:1<");
    expect(html).toContain(">查看详情<");
  });

  it("没有匹配记录时显示中文空状态", () => {
    const html = renderToStaticMarkup(<RecordTable records={[]} />);

    expect(html).toContain("没有符合当前筛选条件的记录");
  });
});
