import { notFound } from "next/navigation";
import { AdminRecordForm } from "@/components/AdminRecordForm";
import { requireAdmin } from "@/lib/auth";
import { getRecordById } from "@/lib/db";
import { updateRecordAction } from "../../actions";
export default async function EditAdminRecordPage({ params }: { params: Promise<{ id: string }> }) { await requireAdmin(); const { id } = await params; const record = await getRecordById(id); if (!record) notFound(); return <><p className="eyebrow">记录管理</p><h1>编辑记录</h1><AdminRecordForm action={updateRecordAction.bind(null, record.id)} record={record} submitLabel="保存修改" /></>; }
