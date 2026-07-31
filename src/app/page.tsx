import Link from "next/link";

import { SummaryMetric } from "@/components/SummaryMetric";
import { getRecords } from "@/lib/db";
import { topValues } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const records = await getRecords();
  const summaries: Array<[string, Array<[string, number]>]> = [
    ["来源类别", topValues(records, "source_category")],
    ["生物活性类别", topValues(records, "activity_category")],
    ["证据等级", topValues(records, "evidence_level")],
  ];

  return (
    <main className="page-shell home-page">
      <p className="eyebrow">标准化科研数据</p>
      <h1>多糖科研数据库</h1>
      <p className="lede">
        汇集多糖来源、结构、文献与生物活性信息的标准化科研数据平台
      </p>
      <Link className="button button--primary" href="/database">检索数据库</Link>
      <section className="metric-grid" aria-label="数据库概览">
        <SummaryMetric label="收录记录" value={records.length} detail="导入科研记录" />
        <SummaryMetric label="文献年份跨度" value="1954-2027" detail="包含未来年份记录" />
        <SummaryMetric label="质量检查通过" value={records.filter((record) => record.data_quality_flags.length === 0).length} detail="无质量标记的记录" />
      </section>
      <section className="summary-grid" aria-label="数据分布概览">
        {summaries.map(([title, values]) => <div className="summary-list" key={title}><h2>{title}</h2><ol>{values.map(([value, count]) => <li key={value}><span>{value}</span><strong>{count}</strong></li>)}</ol></div>)}
      </section>
    </main>
  );
}
