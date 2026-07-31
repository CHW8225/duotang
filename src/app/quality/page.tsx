import Link from "next/link";

import { getRecords } from "@/lib/db";
import { QUALITY_FLAG_LABELS, type QualityFlag } from "@/lib/quality";
import { countQualityFlags, futureYearRecords } from "@/lib/public-data";
import { getTerminologyIssues, TERMINOLOGY_VERSION } from "@/lib/terminology";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  const records = await getRecords();
  const flagCounts = countQualityFlags(records);
  const affected = records.filter((record) => record.data_quality_flags.length > 0);
  const futureRecords = futureYearRecords(records, new Date().getFullYear());
  const terminologyRecords = records
    .map((record) => ({ record, issues: getTerminologyIssues(record) }))
    .filter(({ issues }) => issues.length > 0);

  return (
    <main className="page-shell">
      <p className="eyebrow">数据治理概览</p>
      <h1>数据质量</h1>
      <p className="page-intro">
        质量标记来自导入记录和术语规则 {TERMINOLOGY_VERSION}，用于定位需要进一步科研核验和补充的数据。
      </p>
      <section className="quality-summary">
        <div><span>有质量标记的记录</span><strong>{affected.length}</strong></div>
        <div><span>未来年份记录</span><strong>{futureRecords.length}</strong></div>
        <div><span>术语待人工核对</span><strong>{terminologyRecords.length}</strong></div>
      </section>
      <section className="quality-section">
        <h2>问题统计</h2>
        <div className="issue-list">
          {Object.entries(flagCounts).sort(([, left], [, right]) => right - left).map(([flag, count]) => (
            <div key={flag}><span>{QUALITY_FLAG_LABELS[flag as QualityFlag] ?? flag}</span><strong>{count}</strong></div>
          ))}
        </div>
      </section>
      <section className="quality-section"><h2>受影响记录</h2><RecordLinks records={affected} /></section>
      <section className="quality-section"><h2>未来年份记录</h2><p className="section-note">包含 2027 年的记录。</p><RecordLinks records={futureRecords} /></section>
      <section className="quality-section">
        <h2>术语待人工核对</h2>
        <ul className="record-links">
          {terminologyRecords.map(({ record, issues }) => (
            <li key={record.id}>
              <div>
                <strong>{record.standard_name || record.english_name || record.id}</strong>
                <span>{issues.join("；")}</span>
              </div>
              <Link className="text-link" href={`/records/${record.id}`}>查看记录</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function RecordLinks({ records }: { records: Awaited<ReturnType<typeof getRecords>> }) {
  return (
    <ul className="record-links">
      {records.map((record) => (
        <li key={record.id}>
          <div>
            <strong>{record.standard_name || record.english_name || record.id}</strong>
            <span>{record.publication_year ?? "未记录"} | {record.data_quality_flags.length} 项问题</span>
          </div>
          <Link className="text-link" href={`/records/${record.id}`}>查看记录</Link>
        </li>
      ))}
    </ul>
  );
}
