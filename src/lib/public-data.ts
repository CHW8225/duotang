import type { PolysaccharideRecord } from "./fields";
import {
  normalizeActivityCategories,
  normalizeEvidenceLevel,
  normalizeSourceCategory,
} from "./terminology";

type CategoryField = "source_category" | "activity_category" | "evidence_level";

export function topValues(
  records: PolysaccharideRecord[],
  field: CategoryField,
  limit = 3,
): Array<[string, number]> {
  const counts = new Map<string, number>();

  records.forEach((record) => {
    const rawValue = record[field].trim();
    const values = field === "activity_category"
      ? normalizeActivityCategories(rawValue)
      : [field === "source_category"
          ? normalizeSourceCategory(rawValue)
          : normalizeEvidenceLevel(rawValue)];
    values.filter(Boolean).forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });

  return [...counts.entries()].sort(([, left], [, right]) => right - left).slice(0, limit);
}

export function countQualityFlags(records: PolysaccharideRecord[]): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    record.data_quality_flags.forEach((flag) => {
      counts[flag] = (counts[flag] ?? 0) + 1;
    });
    return counts;
  }, {});
}

export function futureYearRecords(records: PolysaccharideRecord[], currentYear: number) {
  return records.filter((record) => (record.publication_year ?? 0) > currentYear);
}
