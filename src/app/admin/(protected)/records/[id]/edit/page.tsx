import { notFound } from "next/navigation";
import { AdminRecordForm } from "@/components/AdminRecordForm";
import { getRecordById } from "@/lib/db";
import { updateRecordAction } from "../../actions";
export default async function EditAdminRecordPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const record = await getRecordById(id); if (!record) notFound(); return <><p className="eyebrow">Record management</p><h1>Edit record</h1><AdminRecordForm action={updateRecordAction.bind(null, record.id)} record={record} submitLabel="Save changes" /></>; }
