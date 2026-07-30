"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRecord, updateRecord } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
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
  revalidatePath(`/admin/records/${id}/edit`);
}
export async function createRecordAction(
  _previousState: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  await requireAdmin();
  const validation = validateRecordFormData(formData);
  if (!validation.success) return validation.state;
  const record = await createRecord(validation.record);
  revalidateRecordPaths(record.id);
  redirect(`/admin/records/${record.id}/edit`);
}

export async function updateRecordAction(
  id: string,
  _previousState: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  await requireAdmin();
  const validation = validateRecordFormData(formData);
  if (!validation.success) return validation.state;
  const record = await updateRecord(id, validation.record);
  if (!record) redirect("/admin/records");
  revalidateRecordPaths(record.id);
  redirect(`/admin/records/${record.id}/edit`);
}
