"use client";

import { useActionState } from "react";

import { FIELD_DEFINITIONS, type FieldGroup, type PolysaccharideRecord, type ReviewStatus } from "@/lib/fields";
import {
  fieldMaxLength,
  initialRecordActionState,
  type RecordActionState,
} from "@/lib/record-validation";

type RecordFormAction = (
  state: RecordActionState,
  formData: FormData,
) => Promise<RecordActionState>;
type Props = { action: RecordFormAction; record?: PolysaccharideRecord; submitLabel: string };
const groupLabels: Record<FieldGroup, string> = { identity: "基本信息", literature: "文献信息", source: "来源与制备", structure: "结构信息", bioactivity: "生物活性", management: "数据管理" };
const reviewStatuses: ReviewStatus[] = ["待审核", "已审核", "需修改", "未标注"];

export function AdminRecordForm({ action, record, submitLabel }: Props) {
  const [state, formAction, isPending] = useActionState(action, initialRecordActionState);
  return <form action={formAction} className="admin-record-form" noValidate>{state.status === "error" && <div className="admin-form-summary" role="alert">{state.message}</div>}{Object.entries(groupLabels).map(([group, label]) => <fieldset className="admin-form-group" key={group}><legend>{label}</legend><div className="admin-form-grid">{FIELD_DEFINITIONS.filter((field) => field.group === group && field.editable).map((field) => {
    const fallbackValue = field.key === "review_status" ? "未标注" : "";
    const value = state.values[field.key] ?? record?.[field.key] ?? fallbackValue;
    const error = state.fieldErrors[field.key];
    const errorId = `${field.key}-error`;
    const accessibility = { "aria-describedby": error ? errorId : undefined, "aria-invalid": Boolean(error) };
    if (field.key === "review_status") return <label className="admin-form-field" key={field.key}><span>{field.label}</span><select {...accessibility} defaultValue={String(value)} name={field.key}>{reviewStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>{error && <span className="admin-form-error" id={errorId}>{error}</span>}</label>;
    if (field.multiline) return <label className="admin-form-field admin-form-field--wide" key={field.key}><span>{field.label}</span><textarea {...accessibility} defaultValue={String(value)} maxLength={fieldMaxLength(field.key)} name={field.key} rows={4} />{error && <span className="admin-form-error" id={errorId}>{error}</span>}</label>;
    return <label className="admin-form-field" key={field.key}><span>{field.label}</span><input {...accessibility} defaultValue={String(value ?? "")} max={field.key === "publication_year" ? new Date().getFullYear() + 1 : undefined} maxLength={field.key === "publication_year" ? undefined : fieldMaxLength(field.key)} min={field.key === "publication_year" ? 1800 : undefined} name={field.key} required={field.key === "standard_name"} step={field.key === "publication_year" ? 1 : undefined} type={field.key === "publication_year" ? "number" : "text"} />{error && <span className="admin-form-error" id={errorId}>{error}</span>}</label>;
  })}</div></fieldset>)}<div className="admin-form-actions"><button className="button button--primary" disabled={isPending} type="submit">{isPending ? "正在保存..." : submitLabel}</button></div></form>;
}
