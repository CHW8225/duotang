import Link from "next/link";

import { ResearchDashboard } from "@/components/ResearchDashboard";
import { getRecords } from "@/lib/db";
import {
  databaseMetrics,
  publicationYearTrend,
  topValues,
} from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const records = await getRecords();
  const summaries: Array<[string, Array<[string, number]>]> = [
    ["来源类别", topValues(records, "source_category", 6)],
    ["生物活性类别", topValues(records, "activity_category", 6)],
    ["证据等级", topValues(records, "evidence_level", 6)],
  ];
  const metrics = databaseMetrics(records);

  return (
    <main className="page-shell home-page">
      <section className="home-intro">
        <p className="eyebrow">标准化科研数据</p>
        <h1>多糖科研数据库</h1>
        <p className="lede">检索多糖来源、结构、单糖组成、生物活性与文献证据</p>
        <form action="/database" className="home-search" method="get">
          <label className="sr-only" htmlFor="home-keyword">搜索数据库</label>
          <input id="home-keyword" name="keyword" placeholder="搜索多糖名称、物种、活性、单糖组成或 DOI" />
          <button className="button button--primary" type="submit">检索数据库</button>
        </form>
        <div className="home-quick-links">
          <span>常用检索</span>
          {["抗氧化", "免疫调节", "降血糖"].map((activity) => (
            <Link href={`/database?activity=${encodeURIComponent(activity)}`} key={activity}>{activity}</Link>
          ))}
          <Link href="/database?hasDoi=true">含 DOI 记录</Link>
        </div>
      </section>
      <ResearchDashboard
        activityValues={summaries[1][1].slice(0, 6)}
        evidenceValues={summaries[2][1].slice(0, 6)}
        metrics={metrics}
        sourceValues={summaries[0][1].slice(0, 6)}
        yearTrend={publicationYearTrend(records)}
      />
    </main>
  );
}
