export type FieldGroup =
  | "identity"
  | "literature"
  | "source"
  | "structure"
  | "bioactivity"
  | "management";

export type ReviewStatus = "待审核" | "已审核" | "需修改" | "未标注";

export type PolysaccharideRecord = {
  id: string;
  upload_id: string;
  standard_name: string;
  english_name: string;
  aliases: string;
  ref_id: string;
  literature_title: string;
  journal: string;
  publication_year: number | null;
  doi: string;
  pmid: string;
  source_url: string;
  source_species: string;
  source_category: string;
  extraction_part: string;
  extraction_method: string;
  purification_method: string;
  molecular_weight_value: string;
  molecular_weight_unit: string;
  molecular_weight_method: string;
  monosaccharide_original: string;
  monosaccharide_standardized: string;
  monosaccharide_ratio: string;
  glycosidic_linkage: string;
  backbone_description: string;
  branch_description: string;
  branch_site: string;
  substituent_modification: string;
  structure_completeness: string;
  activity_category: string;
  activity_subcategory: string;
  evidence_level: string;
  experiment_type: string;
  experiment_model: string;
  experiment_object: string;
  endpoint: string;
  conclusion: string;
  mechanism_pathway: string;
  key_molecules: string;
  review_status: ReviewStatus;
  recorder: string;
  entry_date: string;
  notes: string;
  data_quality_flags: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
};

export type FieldDefinition = {
  key: keyof PolysaccharideRecord;
  label: string;
  group: FieldGroup;
  editable: boolean;
  multiline?: boolean;
};

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  { key: "upload_id", label: "上传编号", group: "identity", editable: true },
  { key: "standard_name", label: "标准名称", group: "identity", editable: true },
  { key: "english_name", label: "英文名称", group: "identity", editable: true },
  { key: "aliases", label: "别名", group: "identity", editable: true },
  { key: "ref_id", label: "文献编号", group: "identity", editable: true },
  { key: "literature_title", label: "文献标题", group: "literature", editable: true, multiline: true },
  { key: "journal", label: "期刊", group: "literature", editable: true },
  { key: "publication_year", label: "发表年份", group: "literature", editable: true },
  { key: "doi", label: "DOI", group: "literature", editable: true },
  { key: "pmid", label: "PMID", group: "literature", editable: true },
  { key: "source_url", label: "原文链接", group: "literature", editable: true, multiline: true },
  { key: "source_species", label: "来源物种", group: "source", editable: true },
  { key: "source_category", label: "来源类别", group: "source", editable: true },
  { key: "extraction_part", label: "提取部位", group: "source", editable: true },
  { key: "extraction_method", label: "提取方法", group: "source", editable: true, multiline: true },
  { key: "purification_method", label: "纯化方法", group: "source", editable: true, multiline: true },
  { key: "molecular_weight_value", label: "分子量数值", group: "structure", editable: true },
  { key: "molecular_weight_unit", label: "分子量单位", group: "structure", editable: true },
  { key: "molecular_weight_method", label: "分子量测定方法", group: "structure", editable: true },
  { key: "monosaccharide_original", label: "单糖组成原文", group: "structure", editable: true, multiline: true },
  { key: "monosaccharide_standardized", label: "单糖组成标准化", group: "structure", editable: true, multiline: true },
  { key: "monosaccharide_ratio", label: "单糖比例", group: "structure", editable: true },
  { key: "glycosidic_linkage", label: "糖苷键类型", group: "structure", editable: true, multiline: true },
  { key: "backbone_description", label: "主链描述", group: "structure", editable: true, multiline: true },
  { key: "branch_description", label: "支链描述", group: "structure", editable: true, multiline: true },
  { key: "branch_site", label: "分支位点", group: "structure", editable: true, multiline: true },
  { key: "substituent_modification", label: "取代基修饰", group: "structure", editable: true, multiline: true },
  { key: "structure_completeness", label: "结构完整度", group: "structure", editable: true },
  { key: "activity_category", label: "活性大类", group: "bioactivity", editable: true },
  { key: "activity_subcategory", label: "活性子类", group: "bioactivity", editable: true },
  { key: "evidence_level", label: "证据等级", group: "bioactivity", editable: true },
  { key: "experiment_type", label: "实验类型", group: "bioactivity", editable: true },
  { key: "experiment_model", label: "实验模型", group: "bioactivity", editable: true, multiline: true },
  { key: "experiment_object", label: "实验对象", group: "bioactivity", editable: true, multiline: true },
  { key: "endpoint", label: "终点指标", group: "bioactivity", editable: true, multiline: true },
  { key: "conclusion", label: "实验结论", group: "bioactivity", editable: true, multiline: true },
  { key: "mechanism_pathway", label: "机制通路", group: "bioactivity", editable: true, multiline: true },
  { key: "key_molecules", label: "关键分子", group: "bioactivity", editable: true, multiline: true },
  { key: "review_status", label: "审核状态", group: "management", editable: true },
  { key: "recorder", label: "录入人", group: "management", editable: true },
  { key: "entry_date", label: "录入日期", group: "management", editable: true },
  { key: "notes", label: "备注", group: "management", editable: true, multiline: true },
];
