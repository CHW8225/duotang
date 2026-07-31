import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ResearchDashboard } from "./ResearchDashboard";

describe("ResearchDashboard", () => {
  it("renders evidence-based metrics and filter links", () => {
    const html = renderToStaticMarkup(
      <ResearchDashboard
        activityValues={[["抗氧化", 12]]}
        evidenceValues={[["体外", 8]]}
        metrics={{
          total: 20,
          doiCount: 10,
          doiCoverage: 50,
          monosaccharideCount: 15,
          monosaccharideCoverage: 75,
          reviewedCount: 5,
          reviewedCoverage: 25,
          latestUpdate: "2026-07-31T00:00:00.000Z",
        }}
        sourceValues={[["植物", 18]]}
        yearTrend={[[2024, 7], [2025, 9]]}
      />,
    );

    expect(html).toContain("20");
    expect(html).toContain("DOI 覆盖率");
    expect(html).toContain("75%");
    expect(html).toContain("/database?activity=%E6%8A%97%E6%B0%A7%E5%8C%96");
    expect(html).toContain("/database?evidence=%E4%BD%93%E5%A4%96");
    expect(html).toContain("2025");
  });
});
