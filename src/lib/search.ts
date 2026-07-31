import type { PolysaccharideRecord } from "./fields";
import { getPolysaccharideDisplayName } from "./display";
import {
  getBilingualSpeciesName,
  normalizeActivityCategories,
  normalizeEvidenceLevel,
  normalizeSourceCategory,
  normalizeStructureCompleteness,
} from "./terminology";

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
    getPolysaccharideDisplayName(record),
    record.english_name,
    record.aliases,
    record.literature_title,
    record.source_species,
    getBilingualSpeciesName(record.source_species),
    record.source_category,
    normalizeSourceCategory(record.source_category),
    record.extraction_part,
    record.doi,
    record.monosaccharide_original,
    record.monosaccharide_standardized,
    record.monosaccharide_ratio,
    record.activity_category,
    ...normalizeActivityCategories(record.activity_category),
    record.activity_subcategory,
    record.mechanism_pathway,
    record.key_molecules,
    record.conclusion,
  ]
    .join(" ")
    .toLowerCase();

const activityFacets = normalizeActivityCategories;

export function activityFacetValues(records: PolysaccharideRecord[]) {
  return normalizeActivityCategories(
    records.flatMap((record) => activityFacets(record.activity_category)).join("、"),
  );
}

export function filterRecords(records: PolysaccharideRecord[], filters: RecordFilters) {
  const keyword = filters.keyword?.trim().toLowerCase();
  const activityCategory = filters.activityCategory
    ? normalizeActivityCategories(filters.activityCategory)[0] ?? ""
    : "";
  const sourceCategory = filters.sourceCategory
    ? normalizeSourceCategory(filters.sourceCategory)
    : "";
  const evidenceLevel = filters.evidenceLevel
    ? normalizeEvidenceLevel(filters.evidenceLevel)
    : "";
  const structureCompleteness = filters.structureCompleteness
    ? normalizeStructureCompleteness(filters.structureCompleteness)
    : "";
  const filtered = records.filter((record) => {
    if (keyword && !searchableText(record).includes(keyword)) return false;
    if (
      sourceCategory
      && normalizeSourceCategory(record.source_category) !== sourceCategory
    ) return false;
    if (activityCategory && !activityFacets(record.activity_category).includes(activityCategory)) return false;
    if (
      evidenceLevel
      && normalizeEvidenceLevel(record.evidence_level) !== evidenceLevel
    ) return false;
    if (
      structureCompleteness
      && normalizeStructureCompleteness(record.structure_completeness)
        !== structureCompleteness
    ) {
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
