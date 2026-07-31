"use client";

import { useActionState } from "react";

import type { LifecycleActionState } from "@/app/admin/(protected)/records/actions";

type DeleteAction = (
  state: LifecycleActionState,
  formData: FormData,
) => Promise<LifecycleActionState>;

const initialState: LifecycleActionState = { status: "idle" };

export function AdminDeleteRecordPanel({ action, standardName }: { action: DeleteAction; standardName: string }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <section className="admin-form-group" aria-labelledby="delete-record-heading">
    <h2 id="delete-record-heading">移入回收站</h2>
    <p className="section-note">记录将从前台检索、统计和导出中隐藏，附件与收藏关系会保留，并可从回收站恢复。</p>
    <form action={formAction} className="admin-record-form" noValidate>
      {state.message && <p className="admin-form-summary" role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
      <label className="admin-form-field">
        <span>输入完整标准名称“{standardName}”确认</span>
        <input aria-invalid={Boolean(state.fieldErrors?.expectedName)} name="expectedName" required />
        {state.fieldErrors?.expectedName && <span className="admin-form-error">{state.fieldErrors.expectedName}</span>}
      </label>
      <label className="admin-form-field admin-form-field--wide">
        <span>删除原因</span>
        <textarea aria-invalid={Boolean(state.fieldErrors?.reason)} maxLength={500} name="reason" required rows={3} />
        {state.fieldErrors?.reason && <span className="admin-form-error">{state.fieldErrors.reason}</span>}
      </label>
      <button className="button button--quiet" disabled={pending} type="submit">{pending ? "正在处理..." : "移入回收站"}</button>
    </form>
  </section>;
}
