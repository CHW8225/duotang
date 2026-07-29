import Link from "next/link";
import { notFound } from "next/navigation";

import { RecordDetailSections } from "@/components/RecordDetailSections";
import { QualityBadge } from "@/components/QualityBadge";
import { getRecordById } from "@/lib/db";

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getRecordById(id);
  if (!record) notFound();
  return <main className="page-shell"><Link className="back-link" href="/database">Back to database</Link><p className="eyebrow">Record {record.upload_id}</p><h1>{record.standard_name || record.english_name || "Untitled record"}</h1><p className="page-intro">{record.english_name}</p><div className="record-statuses"><QualityBadge value={record.activity_category} /><QualityBadge value={record.evidence_level} /><QualityBadge value={record.review_status} tone="attention" /></div><RecordDetailSections record={record} /></main>;
}
