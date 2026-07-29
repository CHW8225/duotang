"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRecord, updateRecord } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { FIELD_DEFINITIONS, type PolysaccharideRecord, type ReviewStatus } from "@/lib/fields";

const reviewStatuses: ReviewStatus[] = ["待审核", "已审核", "需修改", "未标注"];
function recordFromFormData(formData: FormData): PolysaccharideRecord {
  const values = Object.fromEntries(FIELD_DEFINITIONS.map((field) => [field.key, ""])) as Record<keyof PolysaccharideRecord, string>;
  let publicationYear: number | null = null;
  let reviewStatus: ReviewStatus = "未标注";
  for (const field of FIELD_DEFINITIONS) {
    const value = String(formData.get(field.key) ?? "").trim();
    if (field.key === "publication_year") publicationYear = value ? Number(value) : null;
    else if (field.key === "review_status") reviewStatus = reviewStatuses.includes(value as ReviewStatus) ? value as ReviewStatus : "未标注";
    else values[field.key] = value;
  }
  return { ...values, id: "", publication_year: publicationYear, review_status: reviewStatus, data_quality_flags: [], created_at: "", updated_at: "" };
}
function revalidateRecordPaths(id: string) {
  revalidatePath("/");
  revalidatePath("/database");
  revalidatePath("/quality");
  revalidatePath(`/records/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/records");
  revalidatePath(`/admin/records/${id}/edit`);
}
export async function createRecordAction(formData: FormData) { await requireAdmin(); const record = await createRecord(recordFromFormData(formData)); revalidateRecordPaths(record.id); redirect(`/admin/records/${record.id}/edit`); }
export async function updateRecordAction(id: string, formData: FormData) { await requireAdmin(); const record = await updateRecord(id, recordFromFormData(formData)); if (!record) redirect("/admin/records"); revalidateRecordPaths(record.id); redirect(`/admin/records/${record.id}/edit`); }
