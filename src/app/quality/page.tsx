import Link from "next/link";

import { getRecords } from "@/lib/db";
import { QUALITY_FLAG_LABELS, type QualityFlag } from "@/lib/quality";
import { countQualityFlags, futureYearRecords } from "@/lib/public-data";

export default async function QualityPage() {
  const records = await getRecords();
  const flagCounts = countQualityFlags(records);
  const affected = records.filter((record) => record.data_quality_flags.length > 0);
  const futureRecords = futureYearRecords(records, new Date().getFullYear());

  return (
    <main className="page-shell">
      <p className="eyebrow">Curation overview</p>
      <h1>Quality Dashboard</h1>
      <p className="page-intro">
        Flags are retained from the imported record set and identify records that need scientific
        curation attention.
      </p>
      <section className="quality-summary">
        <div><span>Records with flags</span><strong>{affected.length}</strong></div>
        <div><span>Future-year records</span><strong>{futureRecords.length}</strong></div>
      </section>
      <section className="quality-section">
        <h2>Issue counts</h2>
        <div className="issue-list">
          {Object.entries(flagCounts).sort(([, left], [, right]) => right - left).map(([flag, count]) => (
            <div key={flag}><span>{QUALITY_FLAG_LABELS[flag as QualityFlag] ?? flag}</span><strong>{count}</strong></div>
          ))}
        </div>
      </section>
      <section className="quality-section"><h2>Affected records</h2><RecordLinks records={affected} /></section>
      <section className="quality-section"><h2>Future-year records</h2><p className="section-note">Includes entries dated 2027.</p><RecordLinks records={futureRecords} /></section>
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
            <span>{record.publication_year ?? "No year"} | {record.data_quality_flags.length} flags</span>
          </div>
          <Link className="text-link" href={`/records/${record.id}`}>View record</Link>
        </li>
      ))}
    </ul>
  );
}
