import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "多糖数据填写所有.xlsx"
SHEET_NAME = "单表导入模板"
OUTPUT = ROOT / "data" / "import" / "polysaccharide-records.json"
MANIFEST = ROOT / "data" / "import" / "polysaccharide-import-manifest.json"
CURRENT_YEAR = 2026
IMPORT_TIMESTAMP = "2026-07-29T13:30:33.168228+00:00"

HEADERS = [
    "Upload_ID",
    "标准名称",
    "英文名称",
    "别名",
    "Ref_ID",
    "文献标题",
    "期刊",
    "发表年份",
    "DOI",
    "PMID",
    "原文链接",
    "来源物种",
    "来源类别",
    "提取部位",
    "提取方法",
    "纯化方法",
    "分子量数值",
    "分子量单位",
    "分子量测定方法",
    "单糖组成原文",
    "单糖组成标准化",
    "单糖比例",
    "糖苷键类型",
    "主链描述",
    "支链描述",
    "分支位点",
    "取代基修饰",
    "结构完整度",
    "活性大类",
    "活性子类",
    "证据等级",
    "实验类型",
    "实验模型",
    "实验对象",
    "终点指标",
    "实验结论",
    "机制通路",
    "关键分子",
    "审核状态",
    "录入人",
    "录入日期",
    "备注",
]

COLUMN_KEYS = [
    "upload_id",
    "standard_name",
    "english_name",
    "aliases",
    "ref_id",
    "literature_title",
    "journal",
    "publication_year",
    "doi",
    "pmid",
    "source_url",
    "source_species",
    "source_category",
    "extraction_part",
    "extraction_method",
    "purification_method",
    "molecular_weight_value",
    "molecular_weight_unit",
    "molecular_weight_method",
    "monosaccharide_original",
    "monosaccharide_standardized",
    "monosaccharide_ratio",
    "glycosidic_linkage",
    "backbone_description",
    "branch_description",
    "branch_site",
    "substituent_modification",
    "structure_completeness",
    "activity_category",
    "activity_subcategory",
    "evidence_level",
    "experiment_type",
    "experiment_model",
    "experiment_object",
    "endpoint",
    "conclusion",
    "mechanism_pathway",
    "key_molecules",
    "review_status",
    "recorder",
    "entry_date",
    "notes",
]


def clean(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def parse_year(value: object) -> int | None:
    text = clean(value)
    if not text:
        return None
    try:
        year = float(text)
    except ValueError as error:
        raise ValueError(f"invalid publication year: {text}") from error
    if not year.is_integer():
        raise ValueError(f"publication year must be an integer: {text}")
    return int(year)


def normalize_status(value: object) -> str:
    text = clean(value)
    if text in {"待审核", "已审核", "需修改"}:
        return text
    return "未标注"


def quality_flags(record: dict[str, Any]) -> list[str]:
    checks = [
        ("missing_standard_name", not record["standard_name"]),
        ("missing_english_name", not record["english_name"]),
        ("missing_doi", not record["doi"]),
        ("missing_source_species", not record["source_species"]),
        ("missing_source_category", not record["source_category"]),
        ("missing_molecular_weight", not record["molecular_weight_value"]),
        ("missing_monosaccharide_standardized", not record["monosaccharide_standardized"]),
        ("missing_activity_category", not record["activity_category"]),
        ("missing_evidence_level", not record["evidence_level"]),
        ("missing_conclusion", not record["conclusion"]),
        ("missing_review_status", record["review_status"] == "未标注"),
        (
            "future_publication_year",
            record["publication_year"] is not None
            and record["publication_year"] > CURRENT_YEAR,
        ),
    ]
    return [name for name, failed in checks if failed]


def workbook_sha256() -> str:
    digest = hashlib.sha256()
    with SOURCE.open("rb") as workbook:
        for chunk in iter(lambda: workbook.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_source() -> pd.DataFrame:
    if not SOURCE.exists():
        raise FileNotFoundError(f"source workbook not found: {SOURCE}")
    dataframe = pd.read_excel(
        SOURCE,
        sheet_name=SHEET_NAME,
        keep_default_na=False,
        dtype=object,
    )
    actual_headers = [str(header).strip() for header in dataframe.columns]
    if actual_headers != HEADERS:
        raise ValueError(
            "workbook headers do not match the 42-field import contract\n"
            f"expected: {HEADERS}\nactual: {actual_headers}"
        )
    return dataframe


def source_records() -> tuple[list[dict[str, Any]], list[dict[str, int | str]]]:
    records: list[dict[str, Any]] = []
    source_rows: list[dict[str, int | str]] = []
    for dataframe_index, row in read_source().iterrows():
        values = [row.iloc[position] for position in range(len(HEADERS))]
        if all(clean(value) == "" for value in values):
            continue

        record_id = f"poly-{len(records) + 1:04d}"
        record: dict[str, Any] = {"id": record_id}
        for position, key in enumerate(COLUMN_KEYS):
            value = values[position]
            record[key] = parse_year(value) if key == "publication_year" else clean(value)
        record["review_status"] = normalize_status(record["review_status"])
        record["created_at"] = IMPORT_TIMESTAMP
        record["updated_at"] = IMPORT_TIMESTAMP
        record["data_quality_flags"] = quality_flags(record)
        records.append(record)
        source_rows.append({"id": record_id, "excel_row": int(dataframe_index) + 2})
    return records, source_rows


def build_manifest(source_rows: list[dict[str, int | str]]) -> dict[str, Any]:
    return {
        "source_workbook": SOURCE.name,
        "source_sha256": workbook_sha256(),
        "sheet": SHEET_NAME,
        "record_count": len(source_rows),
        "headers": HEADERS,
        "records": source_rows,
    }


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
