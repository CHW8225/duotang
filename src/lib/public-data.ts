import type { PolysaccharideRecord } from "./fields";

type CategoryField = "source_category" | "activity_category" | "evidence_level";

export function topValues(
  records: PolysaccharideRecord[],
  field: CategoryField,
  limit = 3,
): Array<[string, number]> {
  const counts = new Map<string, number>();

  records.forEach((record) => {
    const value = record[field].trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
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
