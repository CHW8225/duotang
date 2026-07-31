import type { FieldDefinition, FieldGroup, PolysaccharideRecord } from "../lib/fields";
import { FIELD_DEFINITIONS } from "../lib/fields";
import {
  getBilingualSpeciesName,
  normalizeActivityCategories,
  normalizeEvidenceLevel,
  normalizeExperimentType,
  normalizeSourceCategory,
  normalizeStructureCompleteness,
} from "../lib/terminology";

const groups: Array<[FieldGroup, string]> = [
  ["identity", "基本信息"], ["literature", "文献信息"], ["source", "来源与制备"],
  ["structure", "结构信息"], ["bioactivity", "生物活性"], ["management", "数据管理"],
];

function fieldValue(record: PolysaccharideRecord, field: FieldDefinition) {
  const value = record[field.key];
  if (!value) return "未记录";
  if (field.key === "doi") return <a className="text-link" href={`https://doi.org/${value}`} rel="noreferrer" target="_blank">{value}</a>;
  if (field.key === "source_url") return <a className="text-link" href={String(value).startsWith("http") ? String(value) : `https://${value}`} rel="noreferrer" target="_blank">查看来源</a>;
  if (field.key === "source_species") return getBilingualSpeciesName(String(value));
  let normalized = "";
  switch (field.key) {
    case "source_category":
      normalized = normalizeSourceCategory(String(value));
      break;
    case "activity_category":
      normalized = normalizeActivityCategories(String(value)).join("、");
      break;
    case "evidence_level":
      normalized = normalizeEvidenceLevel(String(value));
      break;
    case "experiment_type":
      normalized = normalizeExperimentType(String(value));
      break;
    case "structure_completeness":
      normalized = normalizeStructureCompleteness(String(value));
      break;
  }
  if (normalized && normalized !== value) return <span title={String(value)}>{normalized}</span>;
  return String(value);
}

export function RecordDetailSections({ record }: { record: PolysaccharideRecord }) {
  return <div className="detail-sections">{groups.map(([group, title]) => {
    const fields = FIELD_DEFINITIONS.filter((field) => field.group === group);
    return <section className="detail-section" id={group} key={group}><h2>{title}</h2><dl>{fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{fieldValue(record, field)}</dd></div>)}</dl></section>;
  })}</div>;
}
