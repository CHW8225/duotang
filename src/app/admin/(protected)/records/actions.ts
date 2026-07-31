"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createRecord,
  getRecordById,
  restoreRecord,
  softDeleteRecord,
  updateRecord,
} from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  RecordLifecycleError,
  validateDeletionReason,
} from "../../../../lib/record-lifecycle";
import {
  type RecordActionState,
  validateRecordFormData,
} from "../../../../lib/record-validation";

function revalidateRecordPaths(id: string) {
  revalidatePath("/");
  revalidatePath("/database");
  revalidatePath("/quality");
  revalidatePath(`/records/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/records");
  revalidatePath("/admin/trash");
  revalidatePath(`/admin/records/${id}/edit`);
}
export async function createRecordAction(
  _previousState: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const admin = await requireAdmin();
  const validation = validateRecordFormData(formData);
  if (!validation.success) return validation.state;
  const record = await createRecord(validation.record, admin.username);
  revalidateRecordPaths(record.id);
  redirect(`/admin/records/${record.id}/edit`);
}

export async function updateRecordAction(
  id: string,
  _previousState: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const admin = await requireAdmin();
  const existingRecord = await getRecordById(id);
  if (!existingRecord) redirect("/admin/records");
  const validation = validateRecordFormData(
    formData,
    new Date().getFullYear(),
    existingRecord,
  );
  if (!validation.success) return validation.state;
  const record = await updateRecord(id, validation.record, admin.username);
  if (!record) redirect("/admin/records");
  revalidateRecordPaths(record.id);
  redirect(`/admin/records/${record.id}/edit`);
}

export type LifecycleActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: { expectedName?: string; reason?: string };
};

function lifecycleMessage(error: unknown) {
  if (error instanceof RecordLifecycleError) return error.message;
  return "操作失败，请刷新页面后重试";
}

export async function softDeleteRecordAction(
  id: string,
  _previousState: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const admin = await requireAdmin();
  const expectedName = String(formData.get("expectedName") ?? "").trim();
  const rawReason = String(formData.get("reason") ?? "");
  const record = await getRecordById(id);
  if (!record) return { status: "error", message: "记录不存在或已被删除" };
  const fieldErrors: NonNullable<LifecycleActionState["fieldErrors"]> = {};
  if (expectedName !== record.standard_name) fieldErrors.expectedName = "请输入完整的记录标准名称";
  let reason = "";
  try {
    reason = validateDeletionReason(rawReason);
  } catch (error) {
    fieldErrors.reason = lifecycleMessage(error);
  }
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "请检查删除确认信息", fieldErrors };
  }
  try {
    await softDeleteRecord(id, admin.username, reason, expectedName);
    revalidateRecordPaths(id);
    return { status: "success", message: "记录已移入回收站" };
  } catch (error) {
    return { status: "error", message: lifecycleMessage(error) };
  }
}

export async function restoreRecordAction(
  id: string,
  _previousState: LifecycleActionState,
): Promise<LifecycleActionState> {
  const admin = await requireAdmin();
  try {
    await restoreRecord(id, admin.username);
    revalidateRecordPaths(id);
    return { status: "success", message: "记录已恢复" };
  } catch (error) {
    return { status: "error", message: lifecycleMessage(error) };
  }
}
