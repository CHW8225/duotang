import { describe, expect, it } from "vitest";
import { computeQualityFlags } from "./quality";
import type { PolysaccharideRecord } from "./fields";

const completeRecord: PolysaccharideRecord = {
  id: "rec-1",
  upload_id: "U001",
  standard_name: "Example polysaccharide",
  english_name: "Example polysaccharide",
  aliases: "",
  ref_id: "",
  literature_title: "Example title",
  journal: "Example Journal",
  publication_year: 2024,
  doi: "10.1000/example",
  pmid: "",
  source_url: "",
  source_species: "Citrus medica",
  source_category: "植物",
  extraction_part: "fruit",
  extraction_method: "water extraction",
  purification_method: "",
  molecular_weight_value: "12.5",
  molecular_weight_unit: "kDa",
  molecular_weight_method: "HPLC",
  monosaccharide_original: "",
  monosaccharide_standardized: "Glc; Gal",
  monosaccharide_ratio: "1:2",
  glycosidic_linkage: "",
  backbone_description: "",
  branch_description: "",
  branch_site: "",
  substituent_modification: "",
  structure_completeness: "完整",
  activity_category: "抗氧化",
  activity_subcategory: "",
  evidence_level: "体外",
  experiment_type: "体外实验",
  experiment_model: "",
  experiment_object: "",
  endpoint: "DPPH",
  conclusion: "Shows antioxidant activity.",
  mechanism_pathway: "",
  key_molecules: "",
  review_status: "已审核",
  recorder: "User",
  entry_date: "2026-07-29",
  notes: "",
  data_quality_flags: [],
  created_at: "2026-07-29T00:00:00.000Z",
  updated_at: "2026-07-29T00:00:00.000Z",
};

describe("computeQualityFlags", () => {
  it("returns no flags for a complete current-year-or-earlier record", () => {
    expect(computeQualityFlags(completeRecord, 2026)).toEqual([]);
  });

  it("flags missing required scientific curation fields", () => {
    const record = {
      ...completeRecord,
      doi: "",
      source_species: "",
      source_category: "",
      molecular_weight_value: "",
      monosaccharide_standardized: "",
      activity_category: "",
      evidence_level: "",
      conclusion: "",
      review_status: "未标注" as const,
    };

    expect(computeQualityFlags(record, 2026)).toEqual([
      "missing_doi",
      "missing_source_species",
      "missing_source_category",
      "missing_molecular_weight",
      "missing_monosaccharide_standardized",
      "missing_activity_category",
      "missing_evidence_level",
      "missing_conclusion",
      "missing_review_status",
    ]);
  });

  it("flags publication years later than the current year", () => {
    expect(computeQualityFlags({ ...completeRecord, publication_year: 2027 }, 2026)).toContain(
      "future_publication_year",
    );
  });
});
