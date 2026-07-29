import Link from "next/link";
import { getRecords } from "@/lib/db";

export default async function AdminDashboardPage() {
  const records = await getRecords();
  const pendingReviewCount = records.filter((record) => record.review_status === "待审核").length;
  const flaggedCount = records.filter((record) => record.data_quality_flags.length > 0).length;
  const latestRecords = [...records].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);
  return <><p className="eyebrow">Administrator dashboard</p><h1>Database management</h1><div className="metric-grid"><article className="summary-metric"><span>Total records</span><strong>{records.length}</strong></article><article className="summary-metric"><span>Pending review</span><strong>{pendingReviewCount}</strong></article><article className="summary-metric"><span>Records with quality flags</span><strong>{flaggedCount}</strong></article></div><div className="admin-actions"><Link className="button button--primary" href="/admin/records">Manage records</Link><Link className="button button--quiet" href="/admin/records/new">New record</Link></div><section className="admin-latest"><h2>Latest updated records</h2><ul className="record-links">{latestRecords.map((record) => <li key={record.id}><div><strong>{record.standard_name || "Not recorded"}</strong><span>Updated {new Date(record.updated_at).toLocaleDateString("en-CA")}</span></div><Link className="text-link" href={`/admin/records/${record.id}/edit`}>Edit</Link></li>)}</ul></section></>;
}
