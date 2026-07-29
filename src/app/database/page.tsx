import { RecordFilters } from "@/components/RecordFilters";
import { getRecords } from "@/lib/db";

export default async function DatabasePage() {
  const records = await getRecords();
  return <main className="page-shell"><p className="eyebrow">Browse and filter</p><h1>Database</h1><p className="page-intro">Search the curated collection by source, activity, evidence, structural coverage, review state, and publication period.</p><RecordFilters records={records} /></main>;
}
