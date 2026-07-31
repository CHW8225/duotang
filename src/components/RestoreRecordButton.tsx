"use client";

import { useActionState } from "react";
import type { LifecycleActionState } from "@/app/admin/(protected)/records/actions";

type RestoreAction = (state: LifecycleActionState) => Promise<LifecycleActionState>;

export function RestoreRecordButton({ action }: { action: RestoreAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return <form action={formAction}>
    <button className="button button--quiet" disabled={pending} type="submit">{pending ? "正在恢复..." : "恢复"}</button>
    {state.message && <span role={state.status === "error" ? "alert" : "status"}>{state.message}</span>}
  </form>;
}
