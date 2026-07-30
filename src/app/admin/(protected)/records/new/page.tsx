import { AdminRecordForm } from "@/components/AdminRecordForm";
import { createRecordAction } from "../actions";
export default function NewAdminRecordPage() { return <><p className="eyebrow">记录管理</p><h1>新建记录</h1><AdminRecordForm action={createRecordAction} submitLabel="创建记录" /></>; }
