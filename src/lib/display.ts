import type { PolysaccharideRecord } from "./fields";
import { normalizeMonosaccharideComposition } from "./terminology";

type CompositionRecord = Pick<
  PolysaccharideRecord,
  "monosaccharide_standardized" | "monosaccharide_original"
>;

type RatioRecord = Pick<PolysaccharideRecord, "monosaccharide_ratio">;
type DoiRecord = Pick<PolysaccharideRecord, "doi">;
type NameRecord = Pick<PolysaccharideRecord, "standard_name" | "english_name" | "source_species">;

const reliableChineseNameMap: Array<[RegExp, string]> = [
  [/\bganoderma\s+lucidum\s+polysaccharide\b/i, "灵芝多糖"],
  [/\bastragalus\s+polysaccharide\b/i, "黄芪多糖"],
  [/\blentinan\b|\blentinus\s+edodes\s+polysaccharide\b/i, "香菇多糖"],
  [/\bporia\s+cocos\s+polysaccharide\b/i, "茯苓多糖"],
  [/\bcordyceps\s+polysaccharide\b/i, "虫草多糖"],
  [/\baloe\s+polysaccharide\b/i, "芦荟多糖"],
  [/\binulin\b/i, "菊粉"],
  [/\bpectin\b/i, "果胶"],
];

const reliableSourceNameMap: Array<[RegExp, string]> = [
  [/\bcurcuma\s+longa\b/i, "姜黄"],
];

const reliableChineseSourceNames = new Set([
  "金线莲",
  "晴隆金线莲",
  "高良姜",
  "益智",
  "姜黄",
]);

function cleanDisplayValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function hasChinese(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

export function getMonosaccharideComposition(record: CompositionRecord) {
  const composition = cleanDisplayValue(record.monosaccharide_standardized)
    || cleanDisplayValue(record.monosaccharide_original);
  return normalizeMonosaccharideComposition(composition) || "未记录";
}

export function getMonosaccharideRatio(record: RatioRecord) {
  return cleanDisplayValue(record.monosaccharide_ratio) || "未记录";
}

export function getDisplayDoi(record: DoiRecord) {
  return cleanDisplayValue(record.doi) || "未记录";
}

export function getPolysaccharideDisplayName(record: NameRecord) {
  const standardName = cleanDisplayValue(record.standard_name);
  if (!standardName) return "未记录";
  if (hasChinese(standardName)) return standardName;

  const candidates = [standardName, cleanDisplayValue(record.english_name)].filter(Boolean);
  for (const candidate of candidates) {
    const matched = reliableChineseNameMap.find(([pattern]) => pattern.test(candidate));
    if (matched) return matched[1];
  }

  const sourceSpecies = cleanDisplayValue(record.source_species);
  const englishName = cleanDisplayValue(record.english_name);
  const mappedSource = reliableChineseSourceNames.has(sourceSpecies)
    ? sourceSpecies
    : reliableSourceNameMap.find(([pattern]) => pattern.test(sourceSpecies))?.[1] ?? "";
  if (mappedSource && /\bgalactoglucan\b/i.test(englishName)) {
    return `${mappedSource}半乳葡聚糖（${standardName}）`;
  }
  if (mappedSource && /\bpolysaccharides?\b/i.test(englishName)) {
    return `${mappedSource}多糖（${standardName}）`;
  }
  return standardName;
}
