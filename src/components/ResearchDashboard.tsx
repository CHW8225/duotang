import Link from "next/link";

import type { ReturnTypeOfMetrics } from "@/lib/public-data";

type ValueCount = [string, number];

type Props = {
  metrics: ReturnTypeOfMetrics;
  sourceValues: ValueCount[];
  activityValues: ValueCount[];
  evidenceValues: ValueCount[];
  yearTrend: Array<[number, number]>;
};

function Distribution({
  title,
  values,
  parameter,
}: {
  title: string;
  values: ValueCount[];
  parameter: string;
}) {
  const maximum = Math.max(...values.map(([, count]) => count), 1);
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel__heading">
        <h2>{title}</h2>
        <span>点击查看记录</span>
      </div>
      <ol className="distribution-list">
        {values.map(([value, count]) => (
          <li key={value}>
            <Link href={`/database?${parameter}=${encodeURIComponent(value)}`}>
              <span>{value}</span>
              <span className="distribution-list__track">
                <span style={{ width: `${Math.max((count / maximum) * 100, 3)}%` }} />
              </span>
              <strong>{count}</strong>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ResearchDashboard({
  metrics,
  sourceValues,
  activityValues,
  evidenceValues,
  yearTrend,
}: Props) {
  const recentYears = yearTrend.slice(-12);
  const maximumYear = Math.max(...recentYears.map(([, count]) => count), 1);
  const updatedDate = metrics.latestUpdate
    ? new Date(metrics.latestUpdate).toLocaleDateString("zh-CN")
    : "未记录";

  return (
    <section aria-labelledby="dashboard-title" className="research-dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">数据概览</p>
          <h2 id="dashboard-title">科研数据仪表盘</h2>
        </div>
        <span>最近更新 {updatedDate}</span>
      </div>
      <div className="dashboard-metrics">
        <article><span>收录记录</span><strong>{metrics.total}</strong><small>条标准化记录</small></article>
        <article><span>DOI 覆盖率</span><strong>{metrics.doiCoverage}%</strong><small>{metrics.doiCount} 条含 DOI</small></article>
        <article><span>单糖组成覆盖率</span><strong>{metrics.monosaccharideCoverage}%</strong><small>{metrics.monosaccharideCount} 条已标准化</small></article>
        <article><span>已审核比例</span><strong>{metrics.reviewedCoverage}%</strong><small>{metrics.reviewedCount} 条已审核</small></article>
      </div>
      <div className="dashboard-grid">
        <Distribution parameter="sourceCategory" title="来源类别" values={sourceValues} />
        <Distribution parameter="activity" title="主要活性" values={activityValues} />
        <Distribution parameter="evidence" title="证据等级" values={evidenceValues} />
        <section className="dashboard-panel dashboard-panel--trend">
          <div className="dashboard-panel__heading">
            <h2>发表年份趋势</h2>
            <span>最近 12 个有记录年份</span>
          </div>
          <div className="year-trend">
            {recentYears.map(([year, count]) => (
              <Link href={`/database?yearFrom=${year}&yearTo=${year}`} key={year}>
                <span className="year-trend__bar" style={{ height: `${Math.max((count / maximumYear) * 100, 4)}%` }} />
                <strong>{count}</strong>
                <small>{year}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
