import type { PolysaccharideRecord } from "./fields";
import {
  getMonosaccharideComposition,
  getPolysaccharideDisplayName,
} from "./display";
import {
  getBilingualSpeciesName,
  EVIDENCE_LEVELS,
  normalizeActivityCategories,
  normalizePrimaryActivityCategories,
  PRIMARY_ACTIVITY_CATEGORIES,
  normalizeEvidenceLevel,
  normalizeExperimentType,
  normalizeSourceCategory,
  normalizeSourceCategories,
  normalizeStructureCompleteness,
} from "./terminology";

export type RecordSort =
  | "publication_year"
  | "standard_name"
  | "source_species"
  | "evidence_level"
  | "review_status";

export type RecordPageSize = 25 | 50 | 100;

export type RecordFilters = {
  keyword?: string;
  species?: string;
  sourceCategory?: string;
  activityCategory?: string;
  evidenceLevel?: string;
  experimentType?: string;
  monosaccharide?: string;
  hasDoi?: boolean;
  structureCompleteness?: string;
  reviewStatus?: string;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: RecordSort;
  page?: number;
  pageSize?: RecordPageSize;
};

export type PaginatedRecords = {
  records: PolysaccharideRecord[];
  total: number;
  page: number;
  pageSize: RecordPageSize;
  totalPages: number;
};

export type RecordQueryInput = Record<string, string | string[] | undefined>;

const DEFAULT_PAGE_SIZE: RecordPageSize = 25;
const DEFAULT_SORT: RecordSort = "publication_year";
const PAGE_SIZES = new Set<number>([25, 50, 100]);
const SORT_VALUES = new Set<RecordSort>([
  "publication_year",
  "standard_name",
  "source_species",
  "evidence_level",
  "review_status",
]);
const EVIDENCE_ORDER = [...EVIDENCE_LEVELS];

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
    getMonosaccharideComposition(record),
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

const activityFacets = normalizePrimaryActivityCategories;

const firstQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const queryText = (value: string | string[] | undefined) =>
  firstQueryValue(value)?.trim() || undefined;

const queryNumber = (value: string | string[] | undefined) => {
  const parsed = Number.parseInt(firstQueryValue(value) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizedText = (value: string) => value.trim().toLowerCase();

const evidenceRank = (value: string) => {
  const rank = EVIDENCE_ORDER.indexOf(normalizeEvidenceLevel(value));
  return rank === -1 ? EVIDENCE_ORDER.length : rank;
};

export function activityFacetValues(records: PolysaccharideRecord[]) {
  const values = new Set(
    records.flatMap((record) => activityFacets(record.activity_category)),
  );
  return PRIMARY_ACTIVITY_CATEGORIES.filter((category) => values.has(category));
}

export function filterRecords(records: PolysaccharideRecord[], filters: RecordFilters) {
  const keyword = filters.keyword?.trim().toLowerCase();
  const species = filters.species ? normalizedText(filters.species) : "";
  const activityCategory = filters.activityCategory
    ? normalizePrimaryActivityCategories(filters.activityCategory)[0] ?? ""
    : "";
  const sourceCategory = filters.sourceCategory
    ? normalizeSourceCategories(filters.sourceCategory)[0] ?? ""
    : "";
  const evidenceLevel = filters.evidenceLevel
    ? normalizeEvidenceLevel(filters.evidenceLevel)
    : "";
  const structureCompleteness = filters.structureCompleteness
    ? normalizeStructureCompleteness(filters.structureCompleteness)
    : "";
  const experimentType = filters.experimentType
    ? normalizeExperimentType(filters.experimentType)
    : "";
  const monosaccharide = filters.monosaccharide
    ? normalizedText(filters.monosaccharide)
    : "";
  const filtered = records.filter((record) => {
    if (keyword && !searchableText(record).includes(keyword)) return false;
    if (
      species
      && !normalizedText(
        `${record.source_species} ${getBilingualSpeciesName(record.source_species)}`,
      ).includes(species)
    ) {
      return false;
    }
    if (
      sourceCategory
      && !normalizeSourceCategories(record.source_category).includes(sourceCategory)
    ) return false;
    if (activityCategory && !activityFacets(record.activity_category).includes(activityCategory)) return false;
    if (
      evidenceLevel
      && normalizeEvidenceLevel(record.evidence_level) !== evidenceLevel
    ) return false;
    if (
      experimentType
      && normalizeExperimentType(record.experiment_type) !== experimentType
    ) {
      return false;
    }
    if (
      monosaccharide
      && !normalizedText(
        `${record.monosaccharide_standardized} ${record.monosaccharide_original} ${getMonosaccharideComposition(record)}`,
      ).includes(monosaccharide)
    ) {
      return false;
    }
    if (
      filters.hasDoi !== undefined
      && Boolean(record.doi.trim()) !== filters.hasDoi
    ) {
      return false;
    }
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
      case "evidence_level":
        return evidenceRank(a.evidence_level) - evidenceRank(b.evidence_level);
      case "review_status":
        return a.review_status.localeCompare(b.review_status);
      case "publication_year":
      default:
        return (b.publication_year ?? 0) - (a.publication_year ?? 0);
    }
  });
}

export function parseRecordQuery(input: RecordQueryInput): RecordFilters {
  const pageValue = queryNumber(input.page);
  const pageSizeValue = queryNumber(input.pageSize);
  const sortValue = queryText(input.sort) ?? queryText(input.sortBy);
  const hasDoiValue = queryText(input.hasDoi);

  return {
    keyword: queryText(input.keyword),
    species: queryText(input.species),
    sourceCategory: queryText(input.sourceCategory),
    activityCategory: queryText(input.activity) ?? queryText(input.activityCategory),
    evidenceLevel: queryText(input.evidence) ?? queryText(input.evidenceLevel),
    experimentType: queryText(input.experimentType),
    monosaccharide: queryText(input.monosaccharide),
    hasDoi:
      hasDoiValue === "true" ? true : hasDoiValue === "false" ? false : undefined,
    structureCompleteness: queryText(input.structureCompleteness),
    reviewStatus: queryText(input.reviewStatus),
    yearFrom: queryNumber(input.yearFrom),
    yearTo: queryNumber(input.yearTo),
    sortBy:
      sortValue && SORT_VALUES.has(sortValue as RecordSort)
        ? (sortValue as RecordSort)
        : DEFAULT_SORT,
    page: pageValue && pageValue > 0 ? pageValue : 1,
    pageSize: PAGE_SIZES.has(pageSizeValue ?? 0)
      ? (pageSizeValue as RecordPageSize)
      : DEFAULT_PAGE_SIZE,
  };
}

export function queryRecords(
  records: PolysaccharideRecord[],
  filters: RecordFilters,
): PaginatedRecords {
  const pageSize = PAGE_SIZES.has(filters.pageSize ?? 0)
    ? (filters.pageSize as RecordPageSize)
    : DEFAULT_PAGE_SIZE;
  const filtered = filterRecords(records, filters);
  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const requestedPage =
    Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page! : 1;
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  return {
    records: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}
