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
  const terminologyCount = records.filter((record) => getTerminologyIssues(record).length).length;

  return (
    <main className="page-shell">
      <p className="eyebrow">数据治理概览</p>
      <h1>数据质量</h1>
      <p className="page-intro">
        本页公开可解释的质量汇总与方法，不展示逐条问题清单。标记用于提示后续科研核验，不代表原始文献结论有误。
      </p>
      <section className="quality-summary">
        <div><span>有质量标记的记录</span><strong>{affected.length}</strong></div>
        <div><span>未来年份记录</span><strong>{futureRecords.length}</strong></div>
        <div><span>术语待人工核对</span><strong>{terminologyCount}</strong></div>
      </section>
      <section className="quality-section">
        <h2>问题类型汇总</h2>
        <div className="issue-list">
          {Object.entries(flagCounts).sort(([, left], [, right]) => right - left).map(([flag, count]) => (
            <div key={flag}><span>{QUALITY_FLAG_LABELS[flag as QualityFlag] ?? flag}</span><strong>{count}</strong></div>
          ))}
        </div>
      </section>
      <section className="quality-method">
        <h2>质量方法</h2>
        <p>导入时对关键字段缺失、异常发表年份和受控术语可归类性进行确定性检查，规则版本为 {TERMINOLOGY_VERSION}。</p>
        <p>系统保留原始录入值；规范化值仅用于展示、筛选和统计。详细问题需要管理员登录后逐条核对。</p>
      </section>
    </main>
  );
}
