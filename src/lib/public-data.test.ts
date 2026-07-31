import { describe, expect, it } from "vitest";

import type { PolysaccharideRecord } from "./fields";
import {
  countQualityFlags,
  databaseMetrics,
  futureYearRecords,
  publicationYearTrend,
  topValues,
} from "./public-data";

const records = [
  { source_category: "Plant", activity_category: "Antioxidant", evidence_level: "In vitro", data_quality_flags: ["missing_doi"] },
  { source_category: "Plant", activity_category: "Antioxidant", evidence_level: "Animal", data_quality_flags: ["missing_doi", "missing_conclusion"] },
  { source_category: "Fungi", activity_category: "Immunomodulatory", evidence_level: "Animal", data_quality_flags: [] },
] as PolysaccharideRecord[];

describe("public database summaries", () => {
  it("ranks non-empty category values by frequency", () => {
    expect(topValues(records, "activity_category")).toEqual([
      ["抗氧化", 2],
      ["免疫调节", 1],
    ]);
  });

  it("merges synonymous controlled terms before ranking", () => {
    const variants = [
      { ...records[0], activity_category: "抗氧化活性" },
      { ...records[1], activity_category: "抗氧化" },
      { ...records[2], activity_category: "完整" },
    ] as PolysaccharideRecord[];

    expect(topValues(variants, "activity_category")).toEqual([["抗氧化", 2]]);
  });

  it("counts mixed sources once in each matching primary category", () => {
    const mixedSources = [
      { ...records[0], source_category: "植物、动物" },
      { ...records[1], source_category: "真菌" },
    ] as PolysaccharideRecord[];

    expect(topValues(mixedSources, "source_category")).toEqual([
      ["植物", 1],
      ["动物", 1],
      ["微生物", 1],
    ]);
  });

  it("counts every recorded quality flag across affected records", () => {
    expect(countQualityFlags(records)).toEqual({ missing_doi: 2, missing_conclusion: 1 });
  });

  it("finds only records published after the supplied current year", () => {
    const datedRecords = [
      { ...records[0], publication_year: 2026 },
      { ...records[1], publication_year: 2027 },
      { ...records[2], publication_year: null },
    ];

    expect(futureYearRecords(datedRecords, 2026).map(({ publication_year }) => publication_year)).toEqual([2027]);
  });

  it("computes evidence-based dashboard metrics without inventing missing values", () => {
    const metricRecords = [
      {
        ...records[0],
        doi: "10.1000/a",
        monosaccharide_standardized: "Glc",
        review_status: "已审核",
        updated_at: "2026-07-30T00:00:00.000Z",
      },
      {
        ...records[1],
        doi: "",
        monosaccharide_standardized: "",
        review_status: "待审核",
        updated_at: "2026-07-31T00:00:00.000Z",
      },
    ] as PolysaccharideRecord[];

    expect(databaseMetrics(metricRecords)).toEqual({
      total: 2,
      doiCount: 1,
      doiCoverage: 50,
      monosaccharideCount: 1,
      monosaccharideCoverage: 50,
      reviewedCount: 1,
      reviewedCoverage: 50,
      latestUpdate: "2026-07-31T00:00:00.000Z",
    });
  });

  it("groups publication years chronologically and skips missing years", () => {
    const datedRecords = [
      { ...records[0], publication_year: 2020 },
      { ...records[1], publication_year: 2020 },
      { ...records[2], publication_year: 2022 },
      { ...records[2], publication_year: null },
    ] as PolysaccharideRecord[];

    expect(publicationYearTrend(datedRecords)).toEqual([
      [2020, 2],
      [2022, 1],
    ]);
  });
});
