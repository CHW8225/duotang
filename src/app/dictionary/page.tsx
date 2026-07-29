import { FIELD_DEFINITIONS, type FieldGroup } from "@/lib/fields";

const groupTitles: Record<FieldGroup, string> = { identity: "Identity", literature: "Literature", source: "Source and Preparation", structure: "Structure", bioactivity: "Bioactivity", management: "Data Management" };

export default function DictionaryPage() {
  return <main className="page-shell"><p className="eyebrow">Schema reference</p><h1>Data Dictionary</h1><p className="page-intro">Field definitions used to curate and describe each polysaccharide research record.</p><div className="dictionary-groups">{(Object.keys(groupTitles) as FieldGroup[]).map((group) => <section className="dictionary-group" key={group}><h2>{groupTitles[group]}</h2><div className="dictionary-table"><div className="dictionary-row dictionary-row--head"><span>English key</span><span>Chinese label</span><span>Group</span><span>Editable</span></div>{FIELD_DEFINITIONS.filter((field) => field.group === group).map((field) => <div className="dictionary-row" key={field.key}><code>{field.key}</code><span>{field.label}</span><span>{groupTitles[field.group]}</span><span>{field.editable ? "Yes" : "No"}</span></div>)}</div></section>)}</div></main>;
}
