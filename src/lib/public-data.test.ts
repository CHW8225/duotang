import { describe, expect, it } from "vitest";

import type { PolysaccharideRecord } from "./fields";
import { countQualityFlags, futureYearRecords, topValues } from "./public-data";

const records = [
  { source_category: "Plant", activity_category: "Antioxidant", evidence_level: "In vitro", data_quality_flags: ["missing_doi"] },
  { source_category: "Plant", activity_category: "Antioxidant", evidence_level: "Animal", data_quality_flags: ["missing_doi", "missing_conclusion"] },
  { source_category: "Fungi", activity_category: "Immunomodulatory", evidence_level: "Animal", data_quality_flags: [] },
] as PolysaccharideRecord[];

describe("public database summaries", () => {
  it("ranks non-empty category values by frequency", () => {
    expect(topValues(records, "activity_category")).toEqual([
      ["Antioxidant", 2],
      ["Immunomodulatory", 1],
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
});
