import { notFound } from "next/navigation";
import { AdminRecordForm } from "@/components/AdminRecordForm";
import { AdminDeleteRecordPanel } from "@/components/AdminDeleteRecordPanel";
import { AdminAttachmentManager } from "@/components/AdminAttachmentManager";
import { requireAdmin } from "@/lib/auth";
import { getRecordById } from "@/lib/db";
import { listRecordAttachments } from "@/lib/attachment-repository";
import { softDeleteRecordAction, updateRecordAction } from "../../actions";
import { deleteAttachmentAction, updateAttachmentAction, uploadAttachmentAction } from "./attachment-actions";
export default async function EditAdminRecordPage({params}:{params:Promise<{id:string}>}){await requireAdmin();const {id}=await params;const record=await getRecordById(id);if(!record)notFound();const attachments=await listRecordAttachments(id,true);return <><p className="eyebrow">记录管理</p><h1>编辑记录</h1><AdminRecordForm action={updateRecordAction.bind(null,id)} record={record} submitLabel="保存修改"/><AdminAttachmentManager attachments={attachments} uploadAction={uploadAttachmentAction.bind(null,id)} updateAction={updateAttachmentAction.bind(null,id)} deleteAction={deleteAttachmentAction.bind(null,id)}/><AdminDeleteRecordPanel action={softDeleteRecordAction.bind(null,id)} standardName={record.standard_name}/></>}
