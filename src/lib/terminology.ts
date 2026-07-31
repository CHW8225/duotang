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
  ["Dioscorea alata L.", "参薯"],
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
  ["Siraitia grosuenorii", "罗汉果"],
  ["Siraitia grosvenorii", "罗汉果"],
  ["Passiflora edulia Sims", "百香果"],
  ["Passiflora edulis", "百香果"],
  ["Canarium album (Lour.) Raeusch", "橄榄"],
  ["Annona squamosa L.", "番荔枝"],
  ["Artocarpus heterophyllus Lam.", "菠萝蜜"],
  ["Areca catechu L.", "槟榔"],
  ["Cinnamomum cassia Presl", "肉桂"],
  ["Manilkara zapota (L.) P. Royen", "人心果"],
  ["Manilkara zapota L.", "人心果"],
  ["Theobroma cacao L.", "可可"],
  ["Annona muricata", "刺果番荔枝"],
  ["Malpighia emarginata", "西印度樱桃"],
  ["Carica papaya L. cv. Risheng", "番木瓜"],
  ["Averrhoa carambola L. cv. B10", "杨桃"],
  ["Elaeis guineensis Jacq.", "油棕"],
  ["Anacardium occidentale", "腰果"],
  ["Andrographis paniculata", "穿心莲"],
  ["Andrographis paniculata (Kalmegh)", "穿心莲"],
  ["Camellia japonica L.", "山茶"],
  ["Corchorus capsularis", "黄麻"],
  ["Corchorus capsularis L.", "黄麻"],
  ["Hibiscus cannabinus L.", "洋麻"],
  ["Clausena lansium ( Lour． ) Skeels", "黄皮"],
  ["Synsepalum dulcificum (Schumach. & Thonn.) Daniell", "神秘果"],
  ["Nephelium lappaceum L.", "红毛丹"],
  ["Syzygium aromaticum", "丁香"],
  ["Syzygium samarangense", "莲雾"],
];

export const TERMINOLOGY_VERSION = "2026-07-31-v3";

const speciesMap = new Map(speciesNames);
const chineseSpeciesLatinMap = new Map<string, string>([
  ["余甘子", "Phyllanthus emblica L."],
  ["余甘", "Phyllanthus emblica L."],
  ["铁皮石斛", "Dendrobium officinale Kimura et Migo"],
  ["魔芋", "Amorphophallus konjac K. Koch"],
  ["积雪草", "Centella asiatica (L.) Urb."],
  ["芋头", "Colocasia esculenta (L.) Schott"],
  ["益智", "Alpinia oxyphylla Miq."],
  ["高良姜", "Alpinia officinarum Hance"],
  ["阳春砂", "Amomum villosum Lour."],
  ["金线莲", "Anoectochilus roxburghii (Wall.) Lindl."],
  ["菠萝", "Ananas comosus (L.) Merr."],
  ["木薯", "Manihot esculenta Crantz"],
  ["灵芝", "Ganoderma lucidum"],
  ["剑麻", "Agave sisalana Perrine"],
  ["菊苣", "Cichorium intybus L."],
  ["当归", "Angelica sinensis (Oliv.) Diels"],
]);
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
  if (chineseName) return `${chineseName}（${species}）`;
  const latinName = chineseSpeciesLatinMap.get(species);
  if (latinName) return `${species}（${latinName}）`;
  if (/[\u4e00-\u9fff]/.test(species) && !/[A-Za-z]/.test(species)) {
    return `${species}（拉丁名待核验）`;
  }
  if (/[\u4e00-\u9fff]/.test(species) && /[A-Za-z]/.test(species)) {
    return `${species}（拉丁名待核验）`;
  }
  if (/[A-Za-z]/.test(species) && !/[\u4e00-\u9fff]/.test(species)) {
    return `中文名待核验（${species}）`;
  }
  return species;
}

export const SOURCE_CATEGORIES = ["植物", "动物", "微生物"] as const;

export function normalizeSourceCategories(value: string) {
  const categories = clean(value)
    .split(/[、,，;；/]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      if (/植物|海藻|plant|algae/i.test(item)) return ["植物"];
      if (/动物|animal/i.test(item)) return ["动物"];
      if (/微生物|真菌|microorganism|microbe|fungi|fungus/i.test(item)) return ["微生物"];
      return [];
    });
  return uniqueOrdered(categories, [...SOURCE_CATEGORIES]);
}

export function normalizeSourceCategory(value: string) {
  return normalizeSourceCategories(value).join("、");
}

export const EVIDENCE_LEVELS = [
  "未提及",
  "计算预测",
  "理化表征",
  "体外",
  "体内（动物）",
  "临床",
] as const;

export function normalizeEvidenceLevel(value: string) {
  const text = clean(value);
  if (!text) return "未提及";
  const completedEvidence = text.replace(/[，,；;]?\s*需(?:要)?[^，,；;]*?(?:验证|研究).*$/i, "");
  if (/临床|人体|志愿者/.test(completedEvidence)) return "临床";
  if (/动物|体内|in vivo|小鼠|大鼠|斑马鱼|模式生物|哺乳动物/i.test(completedEvidence)) {
    return "体内（动物）";
  }
  if (/体外|in vitro|细胞|发酵|模拟消化|淋巴细胞|巨噬细胞|肿瘤细胞/i.test(completedEvidence)) {
    return "体外";
  }
  if (/理化|表征|流变|光谱|色谱|分子量/.test(completedEvidence)) return "理化表征";
  if (/计算|模拟|预测|分子对接|in silico/i.test(completedEvidence)) return "计算预测";
  return "未提及";
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
  [/^(?:抗氧化(?:活性)?|antioxidant)$/i, "抗氧化"],
  [/^(?:降血糖|降糖)(?:活性)?$/, "降血糖"],
  [/^(?:抗高血糖|降血糖潜力)(?:活性)?$/, "降血糖"],
  [/^(?:降血脂|降脂|改善血脂)(?:活性)?$/, "降血脂"],
  [/^抗炎(?:活性)?$/, "抗炎"],
  [/^抗肿瘤(?:活性)?$/, "抗肿瘤"],
  [/^抗癌(?:活性)?(?:（[^）]+）)?$/, "抗肿瘤"],
  [/^(?:免疫调节(?:活性)?|immunomodulatory)$/i, "免疫调节"],
  [/^(?:肠道菌群调节|调节肠道菌群|调节肠道微生物群|肠道微生态调节)(?:活性)?$/, "肠道菌群调节"],
  [/^(?:胃肠道?调节|胃肠功能调节|肠道功能调节)(?:活性)?$/, "胃肠功能调节"],
  [/^(?:改善肠道屏障功能|肠道屏障保护|肠道保护)(?:活性)?$/, "肠屏障保护"],
  [/^益生元(?:作用|活性)?$/, "益生元作用"],
  [/^(?:抑菌|抗菌)(?:活性)?$/, "抗菌"],
  [/^抗凝血(?:活性)?$/, "抗凝血"],
  [/^抗血栓(?:活性)?$/, "抗血栓"],
  [/^(?:保肝|抗肝毒性|肝脏保护)(?:活性)?$/, "肝保护"],
  [/^(?:抗肥胖|体重控制)(?:活性)?$/, "抗肥胖"],
  [/^抗衰老(?:活性)?$/, "抗衰老"],
];

function normalizeActivityItem(item: string) {
  const categories: string[] = [];
  if (/DPPH|自由基清除|总还原力|还原能力/i.test(item)) categories.push("抗氧化");
  if (/益生元/.test(item)) categories.push("益生元作用");
  if (/肠道菌群|肠道微生物群|肠道微生态/.test(item)) categories.push("肠道菌群调节");
  if (/^抗肿瘤活性（[^）]+）$/.test(item)) categories.push("抗肿瘤");
  if (/^抗炎活性（[^）]+）$/.test(item)) categories.push("抗炎");
  if (/^(?:乳化(?:性能)?|理化特性|抗冻保护|蛋白质保护|还原剂与稳定剂|酶活性)/.test(item)) {
    categories.push("功能性质");
  }
  if (/^(?:增强吞噬|促进DCs成熟|促NO|TNF-α|IL-6分泌)/.test(item)) {
    categories.push("免疫调节");
  }
  if (categories.length) return categories;
  const alias = activityAliases.find(([pattern]) => pattern.test(item));
  return [alias?.[1] ?? item.replace(/活性$/, "")];
}

export function normalizeActivityCategories(value: string) {
  const facets = clean(value)
    .split(/[、,，;；/|+\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !misplacedActivityValues.has(item))
    .flatMap(normalizeActivityItem);
  return uniqueOrdered(
    facets,
    [
      "抗氧化",
      "降血糖",
      "抗糖尿病",
      "降血脂",
      "抗炎",
      "抗肿瘤",
      "免疫调节",
      "肠道菌群调节",
      "胃肠功能调节",
      "肠屏障保护",
      "益生元作用",
      "抗菌",
      "抗病毒",
      "抗肥胖",
      "肝保护",
      "抗凝血",
      "抗血栓",
      "抗衰老",
      "抗疲劳",
      "抗过敏",
      "代谢调节",
      "功能性质",
    ],
  );
}

export const PRIMARY_ACTIVITY_CATEGORIES = [
  "抗氧化",
  "降血糖",
  "抗糖尿病",
  "降血脂",
  "抗炎",
  "抗肿瘤",
  "免疫调节",
  "肠道菌群调节",
  "胃肠功能调节",
  "肠屏障保护",
  "益生元作用",
  "抗菌",
  "抗病毒",
  "抗肥胖",
  "肝保护",
  "抗凝血",
  "抗血栓",
  "抗衰老",
  "抗疲劳",
  "抗过敏",
  "代谢调节",
  "其他",
] as const;

const primaryActivitySet = new Set<string>(PRIMARY_ACTIVITY_CATEGORIES);

export function normalizePrimaryActivityCategories(value: string) {
  const normalized = normalizeActivityCategories(value);
  const primary = normalized.filter((category) => primaryActivitySet.has(category));
  if (primary.length === 0 && normalized.length > 0) return ["其他"];
  if (primary.length > 1) return primary.filter((category) => category !== "其他");
  return primary;
}

const monosaccharideTerms: Array<[string, string, string[]]> = [
  ["葡萄糖", "Glc", ["glc", "glucose"]],
  ["半乳糖", "Gal", ["gal", "galactose", "d-galactose", "d-gal"]],
  ["阿拉伯糖", "Ara", ["ara", "arabinose"]],
  ["鼠李糖", "Rha", ["rha", "rhamnose"]],
  ["甘露糖", "Man", ["man", "mannose"]],
  ["木糖", "Xyl", ["xyl", "xylose"]],
  ["岩藻糖", "Fuc", ["fuc", "fucose"]],
  ["葡萄糖醛酸", "GlcA", ["glca", "glc-a", "glc-ua", "glcua", "glucuronic acid"]],
  ["半乳糖醛酸", "GalA", ["gala", "gal-a", "gal-ua", "galua", "galacturonic acid"]],
  ["果糖", "Fru", ["fru", "fructose", "d-fructose"]],
  ["核糖", "Rib", ["rib", "ribose", "d-ribose", "d-rib"]],
  ["氨基葡萄糖", "GlcN", ["glcn", "glucosamine"]],
  ["半乳糖胺", "GalN", ["galn", "galactosamine"]],
  ["甘露糖醛酸", "ManA", ["mana", "mannuronic acid"]],
];

const monosaccharideLookup = new Map<string, string>();
monosaccharideTerms.forEach(([chinese, abbreviation, aliases]) => {
  const display = `${chinese}（${abbreviation}）`;
  monosaccharideLookup.set(chinese.toLowerCase(), display);
  monosaccharideLookup.set(abbreviation.toLowerCase(), display);
  aliases.forEach((alias) => monosaccharideLookup.set(alias.toLowerCase(), display));
});
[
  ["d-glucose", "D-葡萄糖（D-Glc）"],
  ["d-glc", "D-葡萄糖（D-Glc）"],
  ["d-葡萄糖", "D-葡萄糖（D-Glc）"],
  ["d-galactose", "D-半乳糖（D-Gal）"],
  ["d-gal", "D-半乳糖（D-Gal）"],
  ["d-arabinose", "D-阿拉伯糖（D-Ara）"],
  ["d-ara", "D-阿拉伯糖（D-Ara）"],
  ["l-arabinose", "L-阿拉伯糖（L-Ara）"],
  ["l-ara", "L-阿拉伯糖（L-Ara）"],
  ["l-rhamnose", "L-鼠李糖（L-Rha）"],
  ["l-rha", "L-鼠李糖（L-Rha）"],
  ["d-mannose", "D-甘露糖（D-Man）"],
  ["d-man", "D-甘露糖（D-Man）"],
  ["d-xylose", "D-木糖（D-Xyl）"],
  ["d-xyl", "D-木糖（D-Xyl）"],
  ["l-fucose", "L-岩藻糖（L-Fuc）"],
  ["l-fuc", "L-岩藻糖（L-Fuc）"],
  ["glucosamine hydrochloride", "氨基葡萄糖盐酸盐（GlcN·HCl）"],
].forEach(([alias, display]) => monosaccharideLookup.set(alias, display));

export function normalizeMonosaccharideComposition(value: string) {
  const text = clean(value);
  if (!text) return "";
  const items = text
    .split(/[、,，;；|+\n]+|\band\b|和|及/iu)
    .flatMap((item) =>
      /^[A-Za-z-]+(?::[A-Za-z-]+)+$/.test(item.trim())
        ? item.split(":")
        : [item],
    );
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const withoutExistingPair = item
        .replace(/[（(]\s*[A-Za-z-]+\s*[）)]$/, "")
        .trim()
        .toLowerCase();
      return monosaccharideLookup.get(withoutExistingPair) ?? item;
    })
    .join("、");
}

type TerminologyRecord = {
  source_species: string;
  activity_category: string;
  evidence_level: string;
  structure_completeness: string;
  monosaccharide_standardized?: string;
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
  if (
    evidence
    && !/未提及|综述|计算|模拟|预测|分子对接|理化|表征|流变|光谱|色谱|分子量|体外|in vitro|细胞|发酵|动物|体内|in vivo|临床|人体|志愿者|淋巴细胞|巨噬细胞|肿瘤细胞/i.test(evidence)
  ) {
    issues.push("证据等级无法归入受控词");
  }
  if (/抗氧化|抗炎|抗肿瘤|降糖|降血糖|降脂|降血脂/.test(record.structure_completeness)) {
    issues.push("结构完整度疑似误填活性");
  }
  if (/(?:^|[、,，;；:\s])Glu(?:$|[、,，;；:\s])/.test(record.monosaccharide_standardized ?? "")) {
    issues.push("单糖缩写 Glu 待人工核对");
  }
  return issues;
}
