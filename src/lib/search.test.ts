import { describe, expect, it } from "vitest";

import type { PolysaccharideRecord } from "./fields";
import { filterRecords } from "./search";

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

  it("filters by evidence level", () => {
    expect(filterRecords(records, { evidenceLevel: "Animal" }).map(({ id }) => id)).toEqual(["mushroom"]);
  });

  it("filters by publication year range", () => {
    expect(filterRecords(records, { yearFrom: 2020, yearTo: 2023 }).map(({ id }) => id)).toEqual(["mushroom"]);
  });

  it("filters by review status", () => {
    expect(filterRecords(records, { reviewStatus: "需修改" }).map(({ id }) => id)).toEqual(["algae"]);
  });

  it("sorts by publication year in descending order by default", () => {
    expect(filterRecords(records, {}).map(({ id }) => id)).toEqual(["citrus", "mushroom", "algae"]);
  });
});
