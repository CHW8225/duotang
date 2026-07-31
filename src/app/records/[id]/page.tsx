import Link from "next/link";
import { notFound } from "next/navigation";

import { RecordDetailSections } from "@/components/RecordDetailSections";
import { QualityBadge } from "@/components/QualityBadge";
import { normalizeActivityCategories, normalizeEvidenceLevel } from "@/lib/terminology";
import { getRecordById } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getRecordById(id);
  if (!record) notFound();
  return <main className="page-shell"><Link className="back-link" href="/database">返回数据检索</Link><p className="eyebrow">记录 {record.upload_id}</p><h1>{record.standard_name || record.english_name || "未命名记录"}</h1><p className="page-intro">{record.english_name}</p><div className="record-statuses"><QualityBadge originalValue={record.activity_category} value={normalizeActivityCategories(record.activity_category).join("、")} /><QualityBadge originalValue={record.evidence_level} value={normalizeEvidenceLevel(record.evidence_level)} /><QualityBadge value={record.review_status} tone="attention" /></div><RecordDetailSections record={record} /></main>;
}
