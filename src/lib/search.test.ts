import { describe, expect, it } from "vitest";

import importedRecords from "../../data/import/polysaccharide-records.json";
import type { PolysaccharideRecord } from "./fields";
import {
  activityFacetValues,
  filterRecords,
  parseRecordQuery,
  queryRecords,
} from "./search";

const record = (overrides: Partial<PolysaccharideRecord>): PolysaccharideRecord => ({
  id: "poly-1",
  upload_id: "upload-1",
  standard_name: "Base polysaccharide",
  english_name: "Base polysaccharide",
  aliases: "",
  ref_id: "ref-1",
  literature_title: "Base literature",
  journal: "Journal",
  publication_year: 2020,
  doi: "10.1000/base",
  pmid: "",
  source_url: "",
  source_species: "Base species",
  source_category: "Plant",
  extraction_part: "",
  extraction_method: "",
  purification_method: "",
  molecular_weight_value: "",
  molecular_weight_unit: "",
  molecular_weight_method: "",
  monosaccharide_original: "",
  monosaccharide_standardized: "",
  monosaccharide_ratio: "",
  glycosidic_linkage: "",
  backbone_description: "",
  branch_description: "",
  branch_site: "",
  substituent_modification: "",
  structure_completeness: "Complete",
  activity_category: "Antioxidant",
  activity_subcategory: "",
  evidence_level: "In vitro",
  experiment_type: "",
  experiment_model: "",
  experiment_object: "",
  endpoint: "",
  conclusion: "Base conclusion",
  mechanism_pathway: "",
  key_molecules: "",
  review_status: "待审核",
  recorder: "",
  entry_date: "",
  notes: "",
  data_quality_flags: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const records = [
  record({ id: "citrus", standard_name: "Citrus polysaccharide", publication_year: 2024 }),
  record({
    id: "mushroom",
    standard_name: "Mushroom polysaccharide",
    source_category: "Fungi",
    activity_category: "Immunomodulatory",
    evidence_level: "Animal",
    structure_completeness: "Partial",
    review_status: "已审核",
    publication_year: 2022,
  }),
  record({
    id: "algae",
    standard_name: "Algae polysaccharide",
    source_species: "Brown algae",
    review_status: "需修改",
    publication_year: 2018,
  }),
];

describe("filterRecords", () => {
  it("filters by a keyword in searchable fields", () => {
    expect(filterRecords(records, { keyword: "  CITRUS " }).map(({ id }) => id)).toEqual(["citrus"]);
  });

  it("filters by DOI and monosaccharide composition keywords", () => {
    const compositionRecord = record({
      id: "composition",
      doi: "10.1016/j.foodchem.2024.138888",
      monosaccharide_standardized: "Glc:Gal:Man",
      monosaccharide_original: "glucose, galactose and mannose",
    });

    expect(filterRecords([compositionRecord], { keyword: "138888" }).map(({ id }) => id)).toEqual(["composition"]);
    expect(filterRecords([compositionRecord], { keyword: "galactose" }).map(({ id }) => id)).toEqual(["composition"]);
    expect(filterRecords([compositionRecord], { keyword: "Glc:Gal" }).map(({ id }) => id)).toEqual(["composition"]);
  });

  it("filters by the Chinese display name when a standard name is translated for display", () => {
    const ganoderma = record({
      id: "ganoderma",
      standard_name: "Ganoderma lucidum polysaccharide",
      english_name: "Ganoderma lucidum polysaccharide",
      source_species: "Ganoderma lucidum",
    });

    expect(filterRecords([ganoderma], { keyword: "灵芝" }).map(({ id }) => id)).toEqual(["ganoderma"]);
  });

  it("filters by source category", () => {
    expect(filterRecords(records, { sourceCategory: "Fungi" }).map(({ id }) => id)).toEqual(["mushroom"]);
  });

  it("filters by activity category", () => {
    expect(filterRecords(records, { activityCategory: "Immunomodulatory" }).map(({ id }) => id)).toEqual([
      "mushroom",
    ]);
  });

  it("matches an exact activity facet inside a compound category", () => {
    const compoundRecords = [
      record({ id: "compound", activity_category: "抗氧化、抗炎" }),
      record({ id: "exact", activity_category: "抗氧化" }),
      record({ id: "similar", activity_category: "抗氧化能力评价" }),
    ];

    expect(
      filterRecords(compoundRecords, { activityCategory: "抗氧化" }).map(({ id }) => id),
    ).toEqual(["compound", "exact"]);
  });

  it("builds activity filter options from normalized facets", () => {
    const options = activityFacetValues([
      record({ activity_category: "抗氧化、抗炎活性" }),
      record({ activity_category: "抗氧化" }),
    ]);

    expect(options).toEqual(["抗氧化", "抗炎"]);
  });

  it("merges synonymous activity labels and excludes misplaced structure labels", () => {
    const options = activityFacetValues([
      record({ activity_category: "抗氧化活性；降血糖活性" }),
      record({ activity_category: "抗糖尿病" }),
      record({ activity_category: "完整" }),
    ]);

    expect(options).toEqual(["抗氧化", "降糖", "抗糖尿病"]);
  });

  it("matches all 331 real records containing the antioxidant facet", () => {
    expect(
      filterRecords(importedRecords as PolysaccharideRecord[], {
        activityCategory: "抗氧化",
      }),
    ).toHaveLength(331);
  });

  it("filters by evidence level", () => {
    expect(filterRecords(records, { evidenceLevel: "Animal" }).map(({ id }) => id)).toEqual(["mushroom"]);
  });

  it("normalizes free-text filter values before comparison", () => {
    const variants = [
      record({
        id: "variant",
        source_category: "微生物,植物",
        activity_category: "降血糖活性",
        evidence_level: "体外实验",
        structure_completeness: "初步完整",
      }),
    ];

    expect(filterRecords(variants, { sourceCategory: "植物,微生物" })).toHaveLength(1);
    expect(filterRecords(variants, { activityCategory: "降血糖活性" })).toHaveLength(1);
    expect(filterRecords(variants, { evidenceLevel: "体外实验" })).toHaveLength(1);
    expect(filterRecords(variants, { structureCompleteness: "初级完整" })).toHaveLength(1);
  });

  it("filters by publication year range", () => {
    expect(filterRecords(records, { yearFrom: 2020, yearTo: 2023 }).map(({ id }) => id)).toEqual(["mushroom"]);
  });

  it("filters by review status", () => {
    expect(filterRecords(records, { reviewStatus: "需修改" }).map(({ id }) => id)).toEqual(["algae"]);
  });

  it("filters by species using either the original or bilingual display term", () => {
    const ganoderma = record({
      id: "ganoderma",
      source_species: "Ganoderma lucidum",
    });
    const citrus = record({
      id: "citrus-species",
      source_species: "Citrus medica L. var. sarcodactylis",
    });

    expect(filterRecords([ganoderma, citrus], { species: "Ganoderma" }).map(({ id }) => id)).toEqual([
      "ganoderma",
    ]);
    expect(filterRecords([ganoderma, citrus], { species: "灵芝" }).map(({ id }) => id)).toEqual([
      "ganoderma",
    ]);
  });

  it("filters experiment type using compatible raw and normalized terms", () => {
    const animalStudy = record({
      id: "animal-study",
      experiment_type: "动物体内实验",
    });
    const cellStudy = record({
      id: "cell-study",
      experiment_type: "细胞实验",
    });

    expect(
      filterRecords([animalStudy, cellStudy], { experimentType: "动物体内实验" }).map(({ id }) => id),
    ).toEqual(["animal-study"]);
    expect(
      filterRecords([animalStudy, cellStudy], { experimentType: "动物实验" }).map(({ id }) => id),
    ).toEqual(["animal-study"]);
  });

  it("filters monosaccharides across standardized and original composition", () => {
    const composition = record({
      id: "composition",
      monosaccharide_standardized: "Glc、Gal、Man",
      monosaccharide_original: "glucose, galactose and mannose",
    });
    const otherComposition = record({
      id: "other-composition",
      monosaccharide_standardized: "Rha、Ara",
      monosaccharide_original: "rhamnose and arabinose",
    });

    expect(
      filterRecords([composition, otherComposition], { monosaccharide: "Gal" }).map(({ id }) => id),
    ).toEqual(["composition"]);
    expect(
      filterRecords([composition, otherComposition], { monosaccharide: "mannose" }).map(({ id }) => id),
    ).toEqual(["composition"]);
  });

  it("filters records by DOI presence", () => {
    const withoutDoi = record({ id: "without-doi", doi: "  " });

    expect(filterRecords([records[0], withoutDoi], { hasDoi: true }).map(({ id }) => id)).toEqual([
      "citrus",
    ]);
    expect(filterRecords([records[0], withoutDoi], { hasDoi: false }).map(({ id }) => id)).toEqual([
      "without-doi",
    ]);
  });

  it("sorts by publication year in descending order by default", () => {
    expect(filterRecords(records, {}).map(({ id }) => id)).toEqual(["citrus", "mushroom", "algae"]);
  });

  it("sorts by normalized evidence level without changing the records", () => {
    const unsorted = [
      record({ id: "animal", evidence_level: "动物实验" }),
      record({ id: "unknown", evidence_level: "理化表征实验" }),
      record({ id: "cell", evidence_level: "体外细胞实验" }),
      record({ id: "vitro", evidence_level: "in vitro" }),
    ];
    const snapshot = structuredClone(unsorted);

    expect(filterRecords(unsorted, { sortBy: "evidence_level" }).map(({ id }) => id)).toEqual([
      "vitro",
      "cell",
      "animal",
      "unknown",
    ]);
    expect(unsorted).toEqual(snapshot);
  });
});

describe("parseRecordQuery", () => {
  it("parses supported filters, sort, page, and page size", () => {
    expect(
      parseRecordQuery({
        activity: "抗氧化",
        evidence: "动物",
        species: "灵芝",
        experimentType: "动物实验",
        monosaccharide: "Glc",
        hasDoi: "true",
        sort: "source_species",
        page: "3",
        pageSize: "50",
      }),
    ).toMatchObject({
      activityCategory: "抗氧化",
      evidenceLevel: "动物",
      species: "灵芝",
      experimentType: "动物实验",
      monosaccharide: "Glc",
      hasDoi: true,
      sortBy: "source_species",
      page: 3,
      pageSize: 50,
    });
  });

  it("defaults invalid pagination and unsupported sorting", () => {
    expect(
      parseRecordQuery({
        page: "-2",
        pageSize: "30",
        sort: "doi",
        hasDoi: "unexpected",
      }),
    ).toMatchObject({
      page: 1,
      pageSize: 25,
      sortBy: "publication_year",
    });
  });

  it("keeps legacy filter and sort parameter names compatible", () => {
    expect(
      parseRecordQuery({
        activityCategory: "抗氧化",
        evidenceLevel: "动物",
        sortBy: "standard_name",
      }),
    ).toMatchObject({
      activityCategory: "抗氧化",
      evidenceLevel: "动物",
      sortBy: "standard_name",
    });
  });
});

describe("queryRecords", () => {
  const pagedRecords = Array.from({ length: 61 }, (_, index) =>
    record({
      id: `poly-${String(index + 1).padStart(3, "0")}`,
      standard_name: `Polysaccharide ${String(index + 1).padStart(3, "0")}`,
      publication_year: 2061 - index,
    }),
  );

  it("returns a 25-record first page and pagination metadata by default", () => {
    const result = queryRecords(pagedRecords, {});

    expect(result.records).toHaveLength(25);
    expect(result).toMatchObject({
      total: 61,
      page: 1,
      pageSize: 25,
      totalPages: 3,
    });
  });

  it.each([25, 50, 100] as const)("accepts page size %i", (pageSize) => {
    expect(queryRecords(pagedRecords, { pageSize }).pageSize).toBe(pageSize);
  });

  it("clamps a page beyond the result range to the last page", () => {
    const result = queryRecords(pagedRecords, { page: 99, pageSize: 25 });

    expect(result.page).toBe(3);
    expect(result.records.map(({ id }) => id)).toEqual(["poly-051", "poly-052", "poly-053", "poly-054", "poly-055", "poly-056", "poly-057", "poly-058", "poly-059", "poly-060", "poly-061"]);
  });

  it("returns page 1 and zero total pages when no records match", () => {
    expect(queryRecords(pagedRecords, { keyword: "not-present" })).toEqual({
      records: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    });
  });

  it("does not mutate the input array or original scientific records", () => {
    const input = structuredClone(pagedRecords);
    const snapshot = structuredClone(input);

    queryRecords(input, { page: 2, pageSize: 25, sortBy: "standard_name" });

    expect(input).toEqual(snapshot);
  });
});
