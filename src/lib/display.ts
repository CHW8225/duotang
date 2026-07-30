import type { PolysaccharideRecord } from "./fields";

type CompositionRecord = Pick<
  PolysaccharideRecord,
  "monosaccharide_standardized" | "monosaccharide_original"
>;

type RatioRecord = Pick<PolysaccharideRecord, "monosaccharide_ratio">;

function cleanDisplayValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function getMonosaccharideComposition(record: CompositionRecord) {
  return cleanDisplayValue(record.monosaccharide_standardized)
    || cleanDisplayValue(record.monosaccharide_original)
    || "未记录";
}

export function getMonosaccharideRatio(record: RatioRecord) {
  return cleanDisplayValue(record.monosaccharide_ratio) || "未记录";
}
