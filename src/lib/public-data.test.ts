import { describe, expect, it } from "vitest";

import type { PolysaccharideRecord } from "./fields";
import { countQualityFlags, topValues } from "./public-data";

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
});
