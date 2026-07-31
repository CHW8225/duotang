import { describe, expect, it } from "vitest";

import {
  getBilingualSpeciesName,
  normalizeActivityCategories,
  normalizeEvidenceLevel,
  normalizeExperimentType,
  getTerminologyIssues,
  normalizeSourceCategory,
  normalizeStructureCompleteness,
} from "./terminology";

describe("科研术语规范化", () => {
  it("物种使用可靠中文名与拉丁名并列显示", () => {
    expect(getBilingualSpeciesName("Citrus medica L. var. sarcodactylis"))
      .toBe("佛手（Citrus medica L. var. sarcodactylis）");
    expect(getBilingualSpeciesName("番石榴 (Psidium guajava Linn.)"))
      .toBe("番石榴（Psidium guajava Linn.）");
  });

  it("无法可靠确认的物种保持原文", () => {
    expect(getBilingualSpeciesName("Examplea officinalis L."))
      .toBe("Examplea officinalis L.");
    expect(getBilingualSpeciesName("Siraitia grosuenorii"))
      .toBe("Siraitia grosuenorii");
  });

  it("来源类别统一分隔符、顺序和重复项", () => {
    expect(normalizeSourceCategory("微生物,植物")).toBe("植物、微生物");
    expect(normalizeSourceCategory("植物/动物")).toBe("植物、动物");
  });

  it("证据等级合并同义写法但保留不同证据层级", () => {
    expect(normalizeEvidenceLevel("体外实验（in vitro）")).toBe("体外");
    expect(normalizeEvidenceLevel("动物/细胞/体外")).toBe("体外、细胞、动物");
    expect(normalizeEvidenceLevel("文献综述")).toBe("综述提及");
    expect(normalizeEvidenceLevel("体内")).toBe("体内");
  });

  it("实验类型归并为可比较的实验层级", () => {
    expect(normalizeExperimentType("体内动物实验；体外细胞实验"))
      .toBe("细胞实验、动物实验");
    expect(normalizeExperimentType("体外化学实验")).toBe("体外实验");
  });

  it("结构完整度合并明显同义词", () => {
    expect(normalizeStructureCompleteness("初级完整")).toBe("初步");
    expect(normalizeStructureCompleteness("初步完整")).toBe("初步");
    expect(normalizeStructureCompleteness("较完整")).toBe("较完整");
    expect(normalizeStructureCompleteness("部分完整")).toBe("部分完整");
  });

  it("活性大类移除活性后缀并合并明确同义词", () => {
    expect(normalizeActivityCategories("抗氧化活性；降血糖活性"))
      .toEqual(["抗氧化", "降糖"]);
    expect(normalizeActivityCategories("降血糖；降血脂；保肝"))
      .toEqual(["降糖", "降脂", "保肝"]);
    expect(normalizeActivityCategories("抗糖尿病")).toEqual(["抗糖尿病"]);
  });

  it("错录的结构完整度不作为活性类别", () => {
    expect(normalizeActivityCategories("完整")).toEqual([]);
    expect(normalizeActivityCategories("初步完整")).toEqual([]);
  });

  it("标记错列值和未收录的纯外文物种供人工核对", () => {
    expect(getTerminologyIssues({
      source_species: "Examplea officinalis L.",
      activity_category: "完整",
      evidence_level: "EC50 值见原文",
      structure_completeness: "抗氧化",
    })).toEqual([
      "来源物种缺少可靠中文名",
      "活性大类疑似误填结构完整度",
      "证据等级无法归入受控词",
      "结构完整度疑似误填活性",
    ]);
  });
});
