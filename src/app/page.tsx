import Link from "next/link";

import { SummaryMetric } from "@/components/SummaryMetric";
import { getRecords } from "@/lib/db";
import { topValues } from "@/lib/public-data";

export default async function Home() {
  const records = await getRecords();
  const summaries: Array<[string, Array<[string, number]>]> = [
    ["Source categories", topValues(records, "source_category")],
    ["Bioactivity categories", topValues(records, "activity_category")],
    ["Evidence levels", topValues(records, "evidence_level")],
  ];

  return (
    <main className="page-shell home-page">
      <p className="eyebrow">Curated scientific records</p>
      <h1>Polysaccharide Research Database</h1>
      <p className="lede">
        Structure, source, literature, and bioactivity records for curated polysaccharide research
      </p>
      <Link className="button button--primary" href="/database">Search the database</Link>
      <section className="metric-grid" aria-label="Database overview">
        <SummaryMetric label="Curated records" value={records.length} detail="Imported research entries" />
        <SummaryMetric label="Publication span" value="1954-2027" detail="Including future-dated records" />
        <SummaryMetric label="Quality review" value={records.filter((record) => record.data_quality_flags.length === 0).length} detail="Records without listed flags" />
      </section>
      <section className="summary-grid" aria-label="Distribution summaries">
        {summaries.map(([title, values]) => <div className="summary-list" key={title}><h2>{title}</h2><ol>{values.map(([value, count]) => <li key={value}><span>{value}</span><strong>{count}</strong></li>)}</ol></div>)}
      </section>
    </main>
  );
}
