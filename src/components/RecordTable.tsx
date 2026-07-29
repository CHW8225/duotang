import Link from "next/link";

import type { PolysaccharideRecord } from "@/lib/fields";
import { QualityBadge } from "./QualityBadge";

export function RecordTable({ records }: { records: PolysaccharideRecord[] }) {
  return (
    <div className="table-wrap">
      <table className="record-table">
        <thead>
          <tr>
            <th>Standard name</th>
            <th>English name</th>
            <th>Source species</th>
            <th>Year</th>
            <th>Activity</th>
            <th>Evidence</th>
            <th>Structure</th>
            <th>Review</th>
            <th><span className="sr-only">Open record</span></th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td className="record-table__empty" colSpan={9}>
                No records match the current filters. Adjust or reset the filters to continue.
              </td>
            </tr>
          ) : records.map((record) => (
            <tr key={record.id}>
              <td className="record-table__primary">{record.standard_name || "Not recorded"}</td>
              <td>{record.english_name || "Not recorded"}</td>
              <td>{record.source_species || "Not recorded"}</td>
              <td>{record.publication_year ?? "-"}</td>
              <td><QualityBadge value={record.activity_category} /></td>
              <td><QualityBadge value={record.evidence_level} /></td>
              <td><QualityBadge value={record.structure_completeness} /></td>
              <td><QualityBadge value={record.review_status} tone="attention" /></td>
              <td><Link className="text-link" href={`/records/${record.id}`}>View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
