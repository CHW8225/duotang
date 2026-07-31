import { describe, expect, it } from "vitest";

import { MAX_SELECTED_RECORDS, selectPageRecords, toggleRecordSelection } from "./selection";

describe("record selection", () => {
  it("toggles a record without mutating the previous selection", () => {
    const selected = ["a"];
    expect(toggleRecordSelection(selected, "b")).toEqual({ ids: ["a", "b"] });
    expect(toggleRecordSelection(selected, "a")).toEqual({ ids: [] });
    expect(selected).toEqual(["a"]);
  });

  it("limits selection to ten records with a clear message", () => {
    const selected = Array.from({ length: MAX_SELECTED_RECORDS }, (_, index) => `id-${index}`);
    expect(toggleRecordSelection(selected, "overflow")).toEqual({
      ids: selected,
      error: "最多可选择 10 条记录，请先取消部分选择。",
    });
  });

  it("selects as many page records as the remaining allowance permits", () => {
    const selected = ["existing"];
    const pageIds = Array.from({ length: 12 }, (_, index) => `page-${index}`);
    const result = selectPageRecords(selected, pageIds);

    expect(result.ids).toHaveLength(10);
    expect(result.ids[0]).toBe("existing");
    expect(result.error).toBe("已选择前 9 条，本次最多可保留 10 条记录。");
  });
});
