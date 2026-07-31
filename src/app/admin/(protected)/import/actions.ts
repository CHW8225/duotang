"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ImportValidationError, inspectImportFile, parseImportWorkbook } from "@/lib/admin-import";
import { ImportConflictError, ImportStateError, confirmImportJob, createImportPreview } from "@/lib/admin-import-repository";

export type ImportActionState = { status: "idle" | "error" | "success"; message?: string; jobId?: string };

function message(error: unknown) {
  if (error instanceof ImportValidationError || error instanceof ImportConflictError || error instanceof ImportStateError) return error.message;
  return "导入操作失败，请检查文件后重试";
}

export async function uploadImportAction(_state: ImportActionState, formData: FormData): Promise<ImportActionState> {
  const admin = await requireAdmin();
  const value = formData.get("file");
  if (!(value instanceof File)) return { status: "error", message: "请选择 .xlsx 文件" };
  try {
    const bytes = Buffer.from(await value.arrayBuffer());
    await inspectImportFile({ name: value.name, type: value.type, bytes });
    const parsed = await parseImportWorkbook(bytes);
    const job = await createImportPreview(value.name, admin.username, parsed.rows);
    revalidatePath("/admin/import");
    return { status: "success", message: job.status === "ready" ? "解析完成，可以确认导入" : "解析完成，请先处理错误或冲突", jobId: job.id };
  } catch (error) { return { status: "error", message: message(error) }; }
}

export async function confirmImportAction(_state: ImportActionState, formData: FormData): Promise<ImportActionState> {
  const admin = await requireAdmin();
  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) return { status: "error", message: "导入任务不存在" };
  try {
    const result = await confirmImportJob(jobId, admin.username);
    for (const path of ["/admin/import", "/admin/records", "/database", "/", "/quality"]) revalidatePath(path);
    return { status: "success", message: `已原子导入 ${result.importedRows} 条记录`, jobId };
  } catch (error) { return { status: "error", message: message(error), jobId }; }
}
