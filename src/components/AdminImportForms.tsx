"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmImportAction, type ImportActionState, uploadImportAction } from "@/app/admin/(protected)/import/actions";

const initial: ImportActionState = { status: "idle" };

export function ImportUploadForm() {
  const [state, action, pending] = useActionState(uploadImportAction, initial);
  return <form action={action} className="admin-form-group"><label htmlFor="import-file">Excel 文件</label><input id="import-file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/><button className="button-primary" disabled={pending} type="submit">{pending ? "正在安全解析…" : "上传并生成预览"}</button>{state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}{state.jobId && <Link href={`/admin/import?job=${state.jobId}`}>查看本次预览</Link>}</form>;
}

export function ImportConfirmForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(confirmImportAction, initial);
  return <form action={action}><input type="hidden" name="jobId" value={jobId}/><button className="button-primary" disabled={pending} type="submit">{pending ? "正在原子导入…" : "确认整批导入"}</button>{state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}</form>;
}
