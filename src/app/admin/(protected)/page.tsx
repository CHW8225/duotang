import Link from "next/link";
import { getRecords } from "@/lib/db";

export default async function AdminDashboardPage() {
  const records = await getRecords();
  const pendingReviewCount = records.filter((record) => record.review_status === "待审核").length;
  const flaggedCount = records.filter((record) => record.data_quality_flags.length > 0).length;
  const latestRecords = [...records].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);
  return <><p className="eyebrow">管理员工作台</p><h1>数据库管理</h1><div className="metric-grid"><article className="summary-metric"><span>记录总数</span><strong>{records.length}</strong></article><article className="summary-metric"><span>待审核记录</span><strong>{pendingReviewCount}</strong></article><article className="summary-metric"><span>含质量标记的记录</span><strong>{flaggedCount}</strong></article></div><div className="admin-actions"><Link className="button button--primary" href="/admin/records">管理记录</Link><Link className="button button--quiet" href="/admin/records/new">新建记录</Link></div><section className="admin-latest"><h2>最近更新的记录</h2><ul className="record-links">{latestRecords.map((record) => <li key={record.id}><div><strong>{record.standard_name || "未记录"}</strong><span>更新于 {new Date(record.updated_at).toLocaleDateString("zh-CN")}</span></div><Link className="text-link" href={`/admin/records/${record.id}/edit`}>编辑</Link></li>)}</ul></section></>;
}
