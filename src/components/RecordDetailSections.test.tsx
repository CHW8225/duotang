import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PolysaccharideRecord } from "@/lib/fields";
import { RecordDetailSections } from "./RecordDetailSections";

describe("RecordDetailSections", () => {
  it("受控字段显示规范值并在悬停中保留原始值", () => {
    const record = {
      source_species: "Citrus medica L. var. sarcodactylis",
      source_category: "微生物,植物",
      activity_category: "抗氧化活性；降血糖活性",
      evidence_level: "体外实验",
      experiment_type: "体外化学实验",
      structure_completeness: "初步完整",
    } as PolysaccharideRecord;

    const html = renderToStaticMarkup(<RecordDetailSections record={record} />);

    expect(html).toContain("佛手（Citrus medica L. var. sarcodactylis）");
    expect(html).toContain('title="微生物,植物">植物、微生物</span>');
    expect(html).toContain('title="抗氧化活性；降血糖活性">抗氧化、降糖</span>');
    expect(html).toContain('title="体外实验">体外</span>');
    expect(html).toContain('title="体外化学实验">体外实验</span>');
    expect(html).toContain('title="初步完整">初步</span>');
  });
});
