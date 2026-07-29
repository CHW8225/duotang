import type { FieldDefinition, FieldGroup, PolysaccharideRecord } from "@/lib/fields";
import { FIELD_DEFINITIONS } from "@/lib/fields";

const groups: Array<[FieldGroup, string]> = [
  ["identity", "Identity"], ["literature", "Literature"], ["source", "Source and Preparation"],
  ["structure", "Structure"], ["bioactivity", "Bioactivity"], ["management", "Data Management"],
];

function fieldValue(record: PolysaccharideRecord, field: FieldDefinition) {
  const value = record[field.key];
  if (!value) return "Not recorded";
  if (field.key === "doi") return <a className="text-link" href={`https://doi.org/${value}`} rel="noreferrer" target="_blank">{value}</a>;
  if (field.key === "source_url") return <a className="text-link" href={String(value).startsWith("http") ? String(value) : `https://${value}`} rel="noreferrer" target="_blank">Open source</a>;
  return String(value);
}

export function RecordDetailSections({ record }: { record: PolysaccharideRecord }) {
  return <div className="detail-sections">{groups.map(([group, title]) => {
    const fields = FIELD_DEFINITIONS.filter((field) => field.group === group);
    return <section className="detail-section" key={group}><h2>{title}</h2><dl>{fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{fieldValue(record, field)}</dd></div>)}</dl></section>;
  })}</div>;
}
