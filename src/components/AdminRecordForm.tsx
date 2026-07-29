import type { FormHTMLAttributes } from "react";
import { FIELD_DEFINITIONS, type FieldGroup, type PolysaccharideRecord, type ReviewStatus } from "@/lib/fields";

type Props = { action: NonNullable<FormHTMLAttributes<HTMLFormElement>["action"]>; record?: PolysaccharideRecord; submitLabel: string };
const groupLabels: Record<FieldGroup, string> = { identity: "Identity", literature: "Literature", source: "Source and preparation", structure: "Structure", bioactivity: "Bioactivity", management: "Data management" };
const reviewStatuses: ReviewStatus[] = ["待审核", "已审核", "需修改", "未标注"];

export function AdminRecordForm({ action, record, submitLabel }: Props) {
  return <form action={action} className="admin-record-form">{Object.entries(groupLabels).map(([group, label]) => <fieldset className="admin-form-group" key={group}><legend>{label}</legend><div className="admin-form-grid">{FIELD_DEFINITIONS.filter((field) => field.group === group && field.editable).map((field) => {
    const value = record?.[field.key] ?? "";
    if (field.key === "review_status") return <label className="admin-form-field" key={field.key}><span>{field.label}</span><select defaultValue={String(value)} name={field.key}>{reviewStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>;
    if (field.multiline) return <label className="admin-form-field admin-form-field--wide" key={field.key}><span>{field.label}</span><textarea defaultValue={String(value)} name={field.key} rows={4} /></label>;
    return <label className="admin-form-field" key={field.key}><span>{field.label}</span><input defaultValue={String(value ?? "")} name={field.key} type={field.key === "publication_year" ? "number" : "text"} /></label>;
  })}</div></fieldset>)}<div className="admin-form-actions"><button className="button button--primary" type="submit">{submitLabel}</button></div></form>;
}
