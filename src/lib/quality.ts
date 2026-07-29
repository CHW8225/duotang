import type { PolysaccharideRecord } from "./fields";

export type QualityFlag =
  | "missing_standard_name"
  | "missing_english_name"
  | "missing_doi"
  | "missing_source_species"
  | "missing_source_category"
  | "missing_molecular_weight"
  | "missing_monosaccharide_standardized"
  | "missing_activity_category"
  | "missing_evidence_level"
  | "missing_conclusion"
  | "missing_review_status"
  | "future_publication_year";

export const QUALITY_FLAG_LABELS: Record<QualityFlag, string> = {
  missing_standard_name: "缺失标准名称",
  missing_english_name: "缺失英文名称",
  missing_doi: "缺失 DOI",
  missing_source_species: "缺失来源物种",
  missing_source_category: "缺失来源类别",
  missing_molecular_weight: "缺失分子量",
  missing_monosaccharide_standardized: "缺失标准化单糖组成",
  missing_activity_category: "缺失活性大类",
  missing_evidence_level: "缺失证据等级",
  missing_conclusion: "缺失实验结论",
  missing_review_status: "缺失审核状态",
  future_publication_year: "发表年份晚于当前年份",
};

const blank = (value: unknown) => String(value ?? "").trim() === "";

export function computeQualityFlags(
  record: PolysaccharideRecord,
  currentYear: number,
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (blank(record.standard_name)) flags.push("missing_standard_name");
  if (blank(record.english_name)) flags.push("missing_english_name");
  if (blank(record.doi)) flags.push("missing_doi");
  if (blank(record.source_species)) flags.push("missing_source_species");
  if (blank(record.source_category)) flags.push("missing_source_category");
  if (blank(record.molecular_weight_value)) flags.push("missing_molecular_weight");
  if (blank(record.monosaccharide_standardized)) flags.push("missing_monosaccharide_standardized");
  if (blank(record.activity_category)) flags.push("missing_activity_category");
  if (blank(record.evidence_level)) flags.push("missing_evidence_level");
  if (blank(record.conclusion)) flags.push("missing_conclusion");
  if (blank(record.review_status) || record.review_status === "未标注") {
    flags.push("missing_review_status");
  }
  if (record.publication_year !== null && record.publication_year > currentYear) {
    flags.push("future_publication_year");
  }

  return flags;
}
