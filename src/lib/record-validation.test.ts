import { describe, expect, it } from "vitest";

import importedRecords from "../../data/import/polysaccharide-records.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
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

function recordFormData(record: PolysaccharideRecord) {
  const formData = new FormData();
  FIELD_DEFINITIONS.forEach(({ key }) => {
    formData.set(key, String(record[key] ?? ""));
  });
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

  it("allows unchanged legacy DOI and URL values while retaining other validation", () => {
    const existing = {
      ...(importedRecords[0] as PolysaccharideRecord),
      doi: "legacy DOI value",
      source_url: "legacy source reference",
    };
    const formData = recordFormData(existing);
    formData.set("standard_name", "");

    const result = validateRecordFormData(formData, 2026, existing);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state.fieldErrors.standard_name).toBe("标准名称为必填项");
      expect(result.state.fieldErrors.doi).toBeUndefined();
      expect(result.state.fieldErrors.source_url).toBeUndefined();
    }
  });

  it("rejects newly changed invalid DOI and URL values", () => {
    const existing = {
      ...(importedRecords[0] as PolysaccharideRecord),
      doi: "legacy DOI value",
      source_url: "legacy source reference",
    };
    const formData = recordFormData(existing);
    formData.set("doi", "new invalid DOI");
    formData.set("source_url", "new invalid URL");

    const result = validateRecordFormData(formData, 2026, existing);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state.fieldErrors.doi).toBe("请输入有效的 DOI");
      expect(result.state.fieldErrors.source_url).toBe(
        "请输入有效的 HTTP 或 HTTPS 链接",
      );
    }
  });

  it("accepts all 772 seed DOI and URL values as unchanged update baselines", () => {
    let strictDoiErrors = 0;
    let strictUrlErrors = 0;

    for (const record of importedRecords as PolysaccharideRecord[]) {
      const strictResult = validateRecordFormData(recordFormData(record), 2026);
      if (!strictResult.success) {
        if (strictResult.state.fieldErrors.doi) strictDoiErrors += 1;
        if (strictResult.state.fieldErrors.source_url) strictUrlErrors += 1;
      }

      const updateResult = validateRecordFormData(
        recordFormData(record),
        2026,
        record,
      );
      if (!updateResult.success) {
        expect(updateResult.state.fieldErrors.doi).toBeUndefined();
        expect(updateResult.state.fieldErrors.source_url).toBeUndefined();
      }
    }

    expect(strictDoiErrors).toBe(7);
    expect(strictUrlErrors).toBe(15);
  });
});
