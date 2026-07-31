import { describe, expect, it } from "vitest";

import {
  getDisplayDoi,
  getMonosaccharideComposition,
  getMonosaccharideRatio,
  getPolysaccharideDisplayName,
} from "./display";

describe("getMonosaccharideComposition", () => {
  it("优先显示标准化单糖组成", () => {
    expect(getMonosaccharideComposition({
      monosaccharide_standardized: "Glc:Gal",
      monosaccharide_original: "glucose and galactose",
    })).toBe("Glc:Gal");
  });

  it("标准化组成空白时回退到原始组成", () => {
    expect(getMonosaccharideComposition({
      monosaccharide_standardized: "   ",
      monosaccharide_original: "glucose and galactose",
    })).toBe("glucose and galactose");
  });

  it("两个组成字段均为空时显示未记录", () => {
    expect(getMonosaccharideComposition({
      monosaccharide_standardized: "",
      monosaccharide_original: "",
    })).toBe("未记录");
  });
});

describe("getMonosaccharideRatio", () => {
  it("比例空白时显示未记录", () => {
    expect(getMonosaccharideRatio({ monosaccharide_ratio: "  " })).toBe("未记录");
  });
});

describe("getDisplayDoi", () => {
  it("DOI 空白时显示未记录", () => {
    expect(getDisplayDoi({ doi: "  " })).toBe("未记录");
  });

  it("DOI 保持原文", () => {
    expect(getDisplayDoi({ doi: "10.1016/j.foodchem.2024.138888" })).toBe("10.1016/j.foodchem.2024.138888");
  });
});

describe("getPolysaccharideDisplayName", () => {
  it("标准名称已有中文时直接显示", () => {
    expect(getPolysaccharideDisplayName({
      standard_name: "灵芝多糖",
      english_name: "Ganoderma lucidum polysaccharide",
      source_species: "灵芝",
    })).toBe("灵芝多糖");
  });

  it("标准名称为英文且存在可靠映射时显示中文", () => {
    expect(getPolysaccharideDisplayName({
      standard_name: "Ganoderma lucidum polysaccharide",
      english_name: "Ganoderma lucidum polysaccharide",
      source_species: "Ganoderma lucidum",
    })).toBe("灵芝多糖");
  });

  it("英文编号类标准名称使用中文来源并保留原编号", () => {
    expect(getPolysaccharideDisplayName({
      standard_name: "AOP30",
      english_name: "Polysaccharide from Alpinia officinarum Hance",
      source_species: "高良姜",
    })).toBe("高良姜多糖（AOP30）");
  });

  it("常见英文多糖类型使用中文术语并保留原编号", () => {
    expect(getPolysaccharideDisplayName({
      standard_name: "AOP-w",
      english_name: "Galactoglucan",
      source_species: "高良姜",
    })).toBe("高良姜半乳葡聚糖（AOP-w）");
  });

  it("仅用于名称显示时可将确定的拉丁来源映射为中文来源", () => {
    expect(getPolysaccharideDisplayName({
      standard_name: "TP-0",
      english_name: "Curcuma longa polysaccharide TP-0",
      source_species: "Curcuma longa L.",
    })).toBe("姜黄多糖（TP-0）");
  });

  it("无法可靠映射时保留原文", () => {
    expect(getPolysaccharideDisplayName({
      standard_name: "Novel polysaccharide fraction GLP-3",
      english_name: "",
      source_species: "Ganoderma lucidum",
    })).toBe("Novel polysaccharide fraction GLP-3");
  });
});
