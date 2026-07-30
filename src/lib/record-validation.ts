import { FIELD_DEFINITIONS, type PolysaccharideRecord, type ReviewStatus } from "./fields";

const REVIEW_STATUSES: ReviewStatus[] = ["待审核", "已审核", "需修改", "未标注"];
const DEFAULT_MAX_LENGTH = 5_000;
const FIELD_MAX_LENGTHS: Partial<Record<keyof PolysaccharideRecord, number>> = {
  standard_name: 300,
  doi: 300,
  source_url: 2_048,
  notes: 10_000,
};

export type RecordFormValues = Partial<Record<keyof PolysaccharideRecord, string>>;
export type RecordActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  values: RecordFormValues;
};

export const initialRecordActionState: RecordActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: {},
};

type ValidationResult =
  | { success: true; record: PolysaccharideRecord }
  | { success: false; state: RecordActionState };

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function fieldMaxLength(key: keyof PolysaccharideRecord) {
  return FIELD_MAX_LENGTHS[key] ?? DEFAULT_MAX_LENGTH;
}

export function validateRecordFormData(
  formData: FormData,
  currentYear = new Date().getFullYear(),
): ValidationResult {
  const values: RecordFormValues = {};
  const normalized = Object.fromEntries(
    FIELD_DEFINITIONS.map((field) => [field.key, ""]),
  ) as Record<keyof PolysaccharideRecord, string>;
  const fieldErrors: Record<string, string> = {};

  for (const field of FIELD_DEFINITIONS) {
    const rawValue = String(formData.get(field.key) ?? "");
    const value = rawValue.trim();
    values[field.key] = rawValue;
    normalized[field.key] = value;
    const maxLength = fieldMaxLength(field.key);
    if (value.length > maxLength) {
      fieldErrors[field.key] = `${field.label}不能超过 ${maxLength} 个字符`;
    }
  }

  if (!normalized.standard_name) {
    fieldErrors.standard_name = "标准名称为必填项";
  }

  const yearText = normalized.publication_year;
  const publicationYear = yearText ? Number(yearText) : null;
  if (
    publicationYear !== null
    && (!Number.isInteger(publicationYear)
      || publicationYear < 1800
      || publicationYear > currentYear + 1)
  ) {
    fieldErrors.publication_year = `发表年份须为 1800 至 ${currentYear + 1} 的整数`;
  }

  if (!REVIEW_STATUSES.includes(normalized.review_status as ReviewStatus)) {
    fieldErrors.review_status = "请选择有效的审核状态";
  }

  const doi = normalized.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  if (normalized.doi && !/^10\.\d{4,9}\/\S+$/i.test(doi)) {
    fieldErrors.doi = "请输入有效的 DOI";
  }

  if (normalized.source_url && !validHttpUrl(normalized.source_url)) {
    fieldErrors.source_url = "请输入有效的 HTTP 或 HTTPS 链接";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      state: {
        status: "error",
        message: "保存失败，请检查标记的字段。",
        fieldErrors,
        values,
      },
    };
  }

  return {
    success: true,
    record: {
      ...normalized,
      id: "",
      publication_year: publicationYear,
      review_status: normalized.review_status as ReviewStatus,
      data_quality_flags: [],
      created_at: "",
      updated_at: "",
    },
  };
}
