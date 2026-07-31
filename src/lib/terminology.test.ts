import { describe, expect, it } from "vitest";

import records from "../../data/import/polysaccharide-records.json";
import {
  getBilingualSpeciesName,
  normalizeActivityCategories,
  normalizeEvidenceLevel,
  normalizeExperimentType,
  normalizeMonosaccharideComposition,
  normalizePrimaryActivityCategories,
  getTerminologyIssues,
  normalizeSourceCategory,
  normalizeSourceCategories,
  normalizeStructureCompleteness,
} from "./terminology";

describe("科研术语规范化", () => {
  it("物种使用可靠中文名与拉丁名并列显示", () => {
    expect(getBilingualSpeciesName("Citrus medica L. var. sarcodactylis"))
      .toBe("佛手（Citrus medica L. var. sarcodactylis）");
    expect(getBilingualSpeciesName("番石榴 (Psidium guajava Linn.)"))
      .toBe("番石榴（Psidium guajava Linn.）");
  });

  it("无法可靠确认的物种明确标记待核验而不编造名称", () => {
    expect(getBilingualSpeciesName("Examplea officinalis L."))
      .toBe("中文名待核验（Examplea officinalis L.）");
    expect(getBilingualSpeciesName("Siraitia grosuenorii"))
      .toBe("罗汉果（Siraitia grosuenorii）");
    expect(getBilingualSpeciesName("仙人掌"))
      .toBe("仙人掌（拉丁名待核验）");
    expect(getBilingualSpeciesName("铁皮石斛"))
      .toBe("铁皮石斛（Dendrobium officinale Kimura et Migo）");
  });

  it("来源类别只归入植物、动物和微生物三个一级类别", () => {
    expect(normalizeSourceCategories("真菌,海藻")).toEqual(["植物", "微生物"]);
    expect(normalizeSourceCategories("微生物,植物")).toEqual(["植物", "微生物"]);
    expect(normalizeSourceCategory("植物/动物")).toBe("植物、动物");
  });

  it("证据等级按最高已证实层级归入六级阶梯", () => {
    expect(normalizeEvidenceLevel("")).toBe("未提及");
    expect(normalizeEvidenceLevel("计算机模拟（分子对接）")).toBe("计算预测");
    expect(normalizeEvidenceLevel("理化表征实验")).toBe("理化表征");
    expect(normalizeEvidenceLevel("体外实验（in vitro）")).toBe("体外");
    expect(normalizeEvidenceLevel("动物/细胞/体外")).toBe("体内（动物）");
    expect(normalizeEvidenceLevel("动物、临床")).toBe("临床");
    expect(normalizeEvidenceLevel("体内动物实验，需临床试验进一步验证"))
      .toBe("体内（动物）");
    expect(normalizeEvidenceLevel("文献综述")).toBe("未提及");
    expect(normalizeEvidenceLevel("高")).toBe("未提及");
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
      .toEqual(["抗氧化", "降血糖"]);
    expect(normalizeActivityCategories("降血糖；降血脂；保肝"))
      .toEqual(["降血糖", "降血脂", "肝保护"]);
    expect(normalizeActivityCategories("抗糖尿病")).toEqual(["抗糖尿病"]);
    expect(normalizeActivityCategories(
      "胃肠道调节；肠道功能调节；调节肠道菌群；肠道菌群调节",
    )).toEqual(["肠道菌群调节", "胃肠功能调节"]);
    expect(normalizeActivityCategories("改善肠道屏障功能；益生元活性"))
      .toEqual(["肠屏障保护", "益生元作用"]);
    expect(normalizeActivityCategories("DPPH自由基清除；羟自由基清除；总还原力"))
      .toEqual(["抗氧化"]);
    expect(normalizeActivityCategories("益生元活性（肠道菌群调节）"))
      .toEqual(["肠道菌群调节", "益生元作用"]);
    expect(normalizeActivityCategories("抗肿瘤活性（前列腺癌）"))
      .toEqual(["抗肿瘤"]);
  });

  it("单糖组成统一为中文与英文缩写并列", () => {
    expect(normalizeMonosaccharideComposition("葡萄糖，半乳糖，Ara，GalA"))
      .toBe("葡萄糖（Glc）、半乳糖（Gal）、阿拉伯糖（Ara）、半乳糖醛酸（GalA）");
    expect(normalizeMonosaccharideComposition("D-mannose, L-rhamnose, GlcA"))
      .toBe("D-甘露糖（D-Man）、L-鼠李糖（L-Rha）、葡萄糖醛酸（GlcA）");
    expect(normalizeMonosaccharideComposition("Glu, Glc-UA, glucosamine hydrochloride"))
      .toBe("Glu、葡萄糖醛酸（GlcA）、氨基葡萄糖盐酸盐（GlcN·HCl）");
    expect(normalizeMonosaccharideComposition("Glc、Gal（摩尔比=5.39:1.04）"))
      .toBe("葡萄糖（Glc）、Gal（摩尔比=5.39:1.04）");
    expect(normalizeMonosaccharideComposition("未测定")).toBe("未测定");
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
      monosaccharide_standardized: "Glu、Gal",
    })).toEqual([
      "来源物种缺少可靠中文名",
      "活性大类疑似误填结构完整度",
      "证据等级无法归入受控词",
      "结构完整度疑似误填活性",
      "单糖缩写 Glu 待人工核对",
    ]);
  });

  it("全库来源物种展示均包含中文说明与原始名称", () => {
    records.forEach((record) => {
      const source = record.source_species.trim();
      if (!source) return;
      const display = getBilingualSpeciesName(source);
      expect(display, source).toMatch(/[\u4e00-\u9fff]/);
      expect(display, source).toContain("（");
      expect(display, source).toContain("）");
    });
  });

  it("全库常见单糖不再以纯中文或纯缩写孤立显示", () => {
    const bareTerms = /(?:^|、)(?:葡萄糖|半乳糖|阿拉伯糖|鼠李糖|甘露糖|木糖|岩藻糖|葡萄糖醛酸|半乳糖醛酸|Glc|Gal|Ara|Rha|Man|Xyl|Fuc|GlcA|GalA)(?:、|$)/;
    records.forEach((record) => {
      const source = record.monosaccharide_standardized.trim()
        || record.monosaccharide_original.trim();
      if (!source) return;
      expect(normalizeMonosaccharideComposition(source), source).not.toMatch(bareTerms);
    });
  });

  it("全库活性同义词收敛且不再暴露常见非规范写法", () => {
    const categories = new Set(
      records.flatMap((record) => normalizeActivityCategories(record.activity_category)),
    );
    expect(categories.size).toBeLessThanOrEqual(50);
    for (const deprecated of [
      "降糖",
      "降脂",
      "保肝",
      "抑菌",
      "调节肠道菌群",
      "调节肠道微生物群",
      "肠道微生态调节",
      "益生元活性",
    ]) {
      expect(categories).not.toContain(deprecated);
    }
  });

  it("前台一级活性类别不暴露机制和疾病模型细分词", () => {
    expect(normalizePrimaryActivityCategories("抗溃疡性结肠炎；抗炎；肠道菌群调节"))
      .toEqual(["抗炎", "肠道菌群调节"]);
    expect(normalizePrimaryActivityCategories("促进乳酸菌胞外多糖(EPS)生产"))
      .toEqual(["其他"]);
    const primaryCategories = new Set(
      records.flatMap((record) => normalizePrimaryActivityCategories(record.activity_category)),
    );
    expect(primaryCategories.size).toBeLessThanOrEqual(22);
  });
});
