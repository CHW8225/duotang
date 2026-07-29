import type { PolysaccharideRecord } from "./fields";

export type RecordFilters = {
  keyword?: string;
  sourceCategory?: string;
  activityCategory?: string;
  evidenceLevel?: string;
  structureCompleteness?: string;
  reviewStatus?: string;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: "publication_year" | "standard_name" | "source_species" | "review_status";
};

const searchableText = (record: PolysaccharideRecord) =>
  [
    record.standard_name,
    record.english_name,
    record.aliases,
    record.literature_title,
    record.source_species,
    record.doi,
    record.activity_category,
    record.activity_subcategory,
    record.mechanism_pathway,
    record.key_molecules,
    record.conclusion,
  ]
    .join(" ")
    .toLowerCase();

export function filterRecords(records: PolysaccharideRecord[], filters: RecordFilters) {
  const keyword = filters.keyword?.trim().toLowerCase();
  const filtered = records.filter((record) => {
    if (keyword && !searchableText(record).includes(keyword)) return false;
    if (filters.sourceCategory && record.source_category !== filters.sourceCategory) return false;
    if (filters.activityCategory && record.activity_category !== filters.activityCategory) return false;
    if (filters.evidenceLevel && record.evidence_level !== filters.evidenceLevel) return false;
    if (filters.structureCompleteness && record.structure_completeness !== filters.structureCompleteness) {
      return false;
    }
    if (filters.reviewStatus && record.review_status !== filters.reviewStatus) return false;
    if (filters.yearFrom && (record.publication_year ?? 0) < filters.yearFrom) return false;
    if (filters.yearTo && (record.publication_year ?? 9999) > filters.yearTo) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case "standard_name":
        return a.standard_name.localeCompare(b.standard_name);
      case "source_species":
        return a.source_species.localeCompare(b.source_species);
      case "review_status":
        return a.review_status.localeCompare(b.review_status);
      case "publication_year":
      default:
        return (b.publication_year ?? 0) - (a.publication_year ?? 0);
    }
  });
}
