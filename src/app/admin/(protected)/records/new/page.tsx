import { AdminRecordForm } from "@/components/AdminRecordForm";
import { createRecordAction } from "../actions";
export default function NewAdminRecordPage() { return <><p className="eyebrow">Record management</p><h1>New record</h1><AdminRecordForm action={createRecordAction} submitLabel="Create record" /></>; }
