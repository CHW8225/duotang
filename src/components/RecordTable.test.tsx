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
  doi: "10.1016/j.foodchem.2024.138888",
  monosaccharide_standardized: "Glc:Gal:Man",
  monosaccharide_original: "glucose, galactose and mannose",
  monosaccharide_ratio: "4:2:1",
} as PolysaccharideRecord;

describe("RecordTable", () => {
  it("用单糖组成和组成比例替换结构与审核列", () => {
    const html = renderToStaticMarkup(<RecordTable records={[record]} />);

    expect(html).toContain("<th>单糖组成</th>");
    expect(html).toContain("<th>组成比例</th>");
    expect(html).toContain("<th>DOI</th>");
    expect(html).not.toContain("<th>Structure</th>");
    expect(html).not.toContain("<th>Review</th>");
    expect(html).toContain('title="10.1016/j.foodchem.2024.138888"');
    expect(html).toContain(">10.1016/j.foodchem.2024.138888<");
    expect(html).toContain('title="葡萄糖（Glc）、半乳糖（Gal）、甘露糖（Man）"');
    expect(html).toContain(">4:2:1<");
    expect(html).toContain(">查看详情<");
  });

  it("没有匹配记录时显示中文空状态", () => {
    const html = renderToStaticMarkup(<RecordTable records={[]} />);

    expect(html).toContain("没有符合当前筛选条件的记录");
  });

  it("DOI 缺失时显示未记录", () => {
    const html = renderToStaticMarkup(<RecordTable records={[{ ...record, doi: " " }]} />);

    expect(html).toContain('title="未记录"');
    expect(html).toContain(">未记录<");
  });

  it("来源物种仅在存在可靠映射时中英并列", () => {
    const html = renderToStaticMarkup(<RecordTable records={[record]} />);

    expect(html).toContain("灵芝（Ganoderma lucidum）");
  });

  it("活性和证据等级显示规范词并保留原始值", () => {
    const html = renderToStaticMarkup(<RecordTable records={[{
      ...record,
      activity_category: "抗氧化活性；降血糖活性",
      evidence_level: "体外实验",
    }]} />);

    expect(html).toContain('title="抗氧化活性；降血糖活性"');
    expect(html).toContain(">抗氧化、降血糖<");
    expect(html).toContain('title="体外实验"');
    expect(html).toContain(">体外<");
  });
});
