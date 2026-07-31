import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getRecords } from "@/lib/db";
import { QUALITY_FLAG_LABELS, type QualityFlag } from "@/lib/quality";
import { getTerminologyIssues } from "@/lib/terminology";

const PAGE_SIZE = 25;

export default async function AdminQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ issue?: string; page?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const records = await getRecords();
  const rows = records.flatMap((record) => {
    const qualityIssues = record.data_quality_flags.map(
      (flag) => QUALITY_FLAG_LABELS[flag as QualityFlag] ?? flag,
    );
    return [...qualityIssues, ...getTerminologyIssues(record)].map((issue) => ({ record, issue }));
  });
  const issueOptions = [...new Set(rows.map(({ issue }) => issue))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const filteredRows = query.issue ? rows.filter(({ issue }) => issue === query.issue) : rows;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams({ page: String(nextPage) });
    if (query.issue) params.set("issue", query.issue);
    return `/admin/quality?${params}`;
  };

  return (
    <>
      <p className="eyebrow">数据治理</p>
      <h1>质量问题清单</h1>
      <p className="page-intro">共 {filteredRows.length} 项问题；按问题类型筛选后可直接进入记录编辑。</p>
      <form action="/admin/quality" className="admin-search" method="get">
        <label className="filter-field filter-field--wide">
          <span>问题类型</span>
          <select defaultValue={query.issue ?? ""} name="issue">
            <option value="">全部问题</option>
            {issueOptions.map((issue) => <option key={issue} value={issue}>{issue}</option>)}
          </select>
        </label>
        <button className="button" type="submit">筛选</button>
        <Link className="text-link" href="/admin/quality">清空</Link>
      </form>
      <div className="admin-quality-list">
        {pageRows.map(({ record, issue }, index) => (
          <div key={`${record.id}-${issue}-${index}`}>
            <span>{issue}</span>
            <strong>{record.standard_name || record.english_name || record.id}</strong>
            <Link className="text-link" href={`/admin/records/${record.id}/edit`}>编辑记录</Link>
          </div>
        ))}
      </div>
      <nav className="pagination" aria-label="质量问题分页">
        {page > 1 ? <Link className="button button--quiet" href={pageHref(page - 1)}>上一页</Link> : <span className="button button--quiet is-disabled">上一页</span>}
        <span>第 {page} 页 / 共 {totalPages} 页</span>
        {page < totalPages ? <Link className="button button--quiet" href={pageHref(page + 1)}>下一页</Link> : <span className="button button--quiet is-disabled">下一页</span>}
      </nav>
    </>
  );
}
