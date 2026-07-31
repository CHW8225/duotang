const speciesNames: Array<[string, string]> = [
  ["Ganoderma lucidum", "灵芝"],
  ["Citrus medica L. var. sarcodactylis", "佛手"],
  ["Citrus medica var. sarcodactylis", "佛手"],
  ["Musa acuminata Colla", "香蕉"],
  ["Aloe barbadensis Miller", "库拉索芦荟"],
  ["Aloe vera", "芦荟"],
  ["Aloe vera L.", "芦荟"],
  ["Abelmoschus esculentus (L.) Moench", "黄秋葵"],
  ["Abelmoschus esculentus L.", "黄秋葵"],
  ["Abelmoschus esculentus L. Moench", "黄秋葵"],
  ["Moringa oleifera Lam.", "辣木"],
  ["Moringa oleifera", "辣木"],
  ["Garcinia mangostana L.", "山竹"],
  ["Hibiscus sabdariffa L.", "玫瑰茄"],
  ["Zingiber officinale Roscoe", "生姜"],
  ["Zingiber officinale Rosc", "生姜"],
  ["Citrus maxima", "柚"],
  ["Passiflora edulis Sims", "百香果"],
  ["Ipomoea batatas (L.) Lam", "甘薯"],
  ["Litchi chinensis Sonn.", "荔枝"],
  ["Dioscorea alata L.", "紫山药"],
  ["Acanthus ilicifolius", "老鼠簕"],
  ["Durio zibethinus", "榴莲"],
  ["Durio zibethinus Murr.", "榴莲"],
  ["Curcuma longa L.", "姜黄"],
  ["Dimocarpus longan Lour.", "龙眼"],
  ["Dimocarpus longan Lour. cv. Chu-liang", "龙眼"],
  ["Dimocarpus longan Lour. cv. Chuliang", "龙眼"],
  ["Dimocarpus longan Lour. cv. Shixia", "龙眼"],
  ["Camellia sinensis", "茶树"],
  ["Camellia sinensis L.", "茶树"],
  ["Camellia sinensis (L.) O. Kuntze", "茶树"],
  ["Tamarindus indica L.", "罗望子"],
  ["Corchorus olitorius L.", "长果黄麻"],
  ["Corchorus olitorius", "长果黄麻"],
  ["Ziziphus jujuba Mill.", "枣"],
  ["Psidium guajava", "番石榴"],
  ["Psidium guajava L.", "番石榴"],
  ["Psidium guajava Linn.", "番石榴"],
  ["Cocos nucifera L.", "椰子"],
  ["Coix lacryma-jobi L.", "薏苡"],
  ["Curcuma kwangsiensis S.G.Lee et C.F.Liang", "广西莪术"],
  ["Curcuma phaeocaulis Val.", "蓬莪术"],
  ["Curcuma phaeocaulis Valeton", "蓬莪术"],
  ["Cymbopogon citratus", "柠檬香茅"],
  ["Ficus hirta Vahl", "五指毛桃"],
  ["Mangifera indica", "芒果"],
  ["Morinda citrifolia L.", "诺丽"],
  ["Piper nigrum", "胡椒"],
  ["Piper nigrum L.", "胡椒"],
  ["Saccharum officinarum", "甘蔗"],
  ["Saccharum officinarum L.", "甘蔗"],
];

export const TERMINOLOGY_VERSION = "2026-07-31-v1";

const speciesMap = new Map(speciesNames);
const misplacedActivityValues = new Set(["完整", "初步完整", "初步", "较完整", "中等"]);

const clean = (value: string) => value.trim().replace(/\s+/g, " ");

function uniqueOrdered(values: string[], order: string[]) {
  return [...new Set(values)].sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right, "zh-CN");
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function getBilingualSpeciesName(value: string) {
  const species = clean(value);
  if (!species) return "未记录";
  const bilingual = species.match(/^(.+?)\s*[（(]\s*([^（）()]+)\s*[）)]$/);
  if (bilingual && /[\u4e00-\u9fff]/.test(bilingual[1]) && /[A-Za-z]/.test(bilingual[2])) {
    return `${bilingual[1].trim()}（${bilingual[2].trim()}）`;
  }
  const chineseName = speciesMap.get(species);
  return chineseName ? `${chineseName}（${species}）` : species;
}

export function normalizeSourceCategory(value: string) {
  const categories = clean(value).split(/[、,，;；/]+/).map((item) => item.trim()).filter(Boolean);
  return uniqueOrdered(categories, ["植物", "真菌", "微生物", "动物", "海藻"]).join("、");
}

export function normalizeEvidenceLevel(value: string) {
  const text = clean(value);
  if (!text) return "";
  const levels: string[] = [];
  if (/综述/.test(text)) levels.push("综述提及");
  if (/体外|in vitro|化学法|发酵/.test(text)) levels.push("体外");
  if (/细胞/.test(text)) levels.push("细胞");
  if (/动物|鼠|斑马鱼|模式生物/.test(text)) levels.push("动物");
  if (/临床/.test(text)) levels.push("临床");
  return uniqueOrdered(levels, ["综述提及", "体外", "细胞", "动物", "临床"]).join("、") || text;
}

export function normalizeExperimentType(value: string) {
  const text = clean(value);
  if (!text) return "";
  const types: string[] = [];
  if (/综述/.test(text)) types.push("文献综述");
  const withoutCellExperiments = text.replace(/体外细胞实验/g, "细胞实验");
  if (/体外|化学|酶抑制|自由基|发酵|抑菌|生化|模拟消化/.test(withoutCellExperiments)) {
    types.push("体外实验");
  }
  if (/细胞/.test(text)) types.push("细胞实验");
  if (/动物|体内|模式生物|膳食干预/.test(text)) types.push("动物实验");
  if (/临床|志愿者|人体/.test(text)) types.push("临床研究");
  return uniqueOrdered(
    types,
    ["文献综述", "体外实验", "细胞实验", "动物实验", "临床研究"],
  ).join("、") || text;
}

export function normalizeStructureCompleteness(value: string) {
  const text = clean(value);
  if (!text) return "";
  if (/较完整|基本解析/.test(text)) return "较完整";
  if (/部分完整/.test(text)) return "部分完整";
  if (/中等/.test(text)) return "中等";
  if (/初步|初级|一级结构初步|初级结完整/.test(text)) return "初步";
  if (/高度解析|完整$/.test(text)) return "完整";
  return text;
}

const activityAliases: Array<[RegExp, string]> = [
  [/^抗氧化(?:活性)?$/, "抗氧化"],
  [/^(?:降血糖|降糖)(?:活性)?$/, "降糖"],
  [/^(?:降血脂|降脂)(?:活性)?$/, "降脂"],
  [/^抗炎(?:活性)?$/, "抗炎"],
  [/^抗肿瘤(?:活性)?$/, "抗肿瘤"],
  [/^免疫调节(?:活性)?$/, "免疫调节"],
  [/^(?:肠道菌群调节|调节肠道微生物群)(?:活性)?$/, "肠道菌群调节"],
  [/^益生元(?:活性)?$/, "益生元"],
];

export function normalizeActivityCategories(value: string) {
  const facets = clean(value)
    .split(/[、,，;；/|+\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !misplacedActivityValues.has(item))
    .map((item) => {
      const alias = activityAliases.find(([pattern]) => pattern.test(item));
      return alias?.[1] ?? item.replace(/活性$/, "");
    });
  return uniqueOrdered(
    facets,
    ["抗氧化", "降糖", "降脂", "抗炎", "抗肿瘤", "免疫调节", "肠道菌群调节", "益生元"],
  );
}

type TerminologyRecord = {
  source_species: string;
  activity_category: string;
  evidence_level: string;
  structure_completeness: string;
};

export function getTerminologyIssues(record: TerminologyRecord) {
  const issues: string[] = [];
  const species = clean(record.source_species);
  if (
    species
    && /[A-Za-z]/.test(species)
    && !/[\u4e00-\u9fff]/.test(species)
    && !speciesMap.has(species)
  ) {
    issues.push("来源物种缺少可靠中文名");
  }
  if (misplacedActivityValues.has(clean(record.activity_category))) {
    issues.push("活性大类疑似误填结构完整度");
  }
  const evidence = clean(record.evidence_level);
  if (evidence && normalizeEvidenceLevel(evidence) === evidence && !/^(体外|细胞|动物|临床|综述提及)$/.test(evidence)) {
    issues.push("证据等级无法归入受控词");
  }
  if (/抗氧化|抗炎|抗肿瘤|降糖|降脂/.test(record.structure_completeness)) {
    issues.push("结构完整度疑似误填活性");
  }
  return issues;
}
