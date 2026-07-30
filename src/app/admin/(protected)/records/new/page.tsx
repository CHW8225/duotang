import { AdminRecordForm } from "@/components/AdminRecordForm";
import { requireAdmin } from "@/lib/auth";
import { createRecordAction } from "../actions";
export default async function NewAdminRecordPage() { await requireAdmin(); return <><p className="eyebrow">记录管理</p><h1>新建记录</h1><AdminRecordForm action={createRecordAction} submitLabel="创建记录" /></>; }
