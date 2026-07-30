import { describe, expect, it } from "vitest";

import { validateRecordFormData } from "./record-validation";

function validFormData() {
  const formData = new FormData();
  formData.set("standard_name", "测试多糖");
  formData.set("publication_year", "2026");
  formData.set("review_status", "待审核");
  formData.set("doi", "10.1000/example");
  formData.set("source_url", "https://example.com/article");
  return formData;
}

describe("validateRecordFormData", () => {
  it("rejects an empty standard name with a Chinese field error", () => {
    const formData = validFormData();
    formData.set("standard_name", " ");

    const result = validateRecordFormData(formData, 2026);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state.fieldErrors.standard_name).toBe("标准名称为必填项");
      expect(result.state.values.standard_name).toBe(" ");
    }
  });

  it.each(["2020.5", "NaN", "1799", "2028"])(
    "rejects invalid publication year %s",
    (year) => {
      const formData = validFormData();
      formData.set("publication_year", year);

      const result = validateRecordFormData(formData, 2026);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.state.fieldErrors.publication_year).toContain("发表年份");
      }
    },
  );

  it("accepts an empty publication year without producing NaN", () => {
    const formData = validFormData();
    formData.set("publication_year", "");

    const result = validateRecordFormData(formData, 2026);

    expect(result.success).toBe(true);
    if (result.success) expect(result.record.publication_year).toBeNull();
  });

  it("rejects invalid review status, DOI, URL, and overlong fields", () => {
    const formData = validFormData();
    formData.set("review_status", "approved");
    formData.set("doi", "not-a-doi");
    formData.set("source_url", "javascript:alert(1)");
    formData.set("notes", "x".repeat(10_001));

    const result = validateRecordFormData(formData, 2026);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state.fieldErrors).toMatchObject({
        review_status: "请选择有效的审核状态",
        doi: "请输入有效的 DOI",
        source_url: "请输入有效的 HTTP 或 HTTPS 链接",
        notes: "备注不能超过 10000 个字符",
      });
    }
  });

  it("returns trimmed validated data for persistence", () => {
    const formData = validFormData();
    formData.set("standard_name", "  测试多糖  ");

    const result = validateRecordFormData(formData, 2026);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.standard_name).toBe("测试多糖");
      expect(Number.isNaN(result.record.publication_year)).toBe(false);
    }
  });
});
