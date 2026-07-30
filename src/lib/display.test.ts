import { describe, expect, it } from "vitest";

import {
  getMonosaccharideComposition,
  getMonosaccharideRatio,
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
