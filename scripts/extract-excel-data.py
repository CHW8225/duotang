import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "多糖数据填写所有.xlsx"
SHEET_NAME = "单表导入模板"
OUTPUT = ROOT / "data" / "import" / "polysaccharide-records.json"
CURRENT_YEAR = 2026

COLUMN_KEYS = [
    "upload_id", "standard_name", "english_name", "aliases", "ref_id",
    "literature_title", "journal", "publication_year", "doi", "pmid", "source_url",
    "source_species", "source_category", "extraction_part", "extraction_method",
    "purification_method", "molecular_weight_value", "molecular_weight_unit",
    "molecular_weight_method", "monosaccharide_original", "monosaccharide_standardized",
    "monosaccharide_ratio", "glycosidic_linkage", "backbone_description",
    "branch_description", "branch_site", "substituent_modification",
    "structure_completeness", "activity_category", "activity_subcategory",
    "evidence_level", "experiment_type", "experiment_model", "experiment_object",
    "endpoint", "conclusion", "mechanism_pathway", "key_molecules",
    "review_status", "recorder", "entry_date", "notes",
]


def clean(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def parse_year(value: object) -> int | None:
    if pd.isna(value) or str(value).strip() == "":
        return None
    try:
        return int(float(str(value)))
    except ValueError:
        return None


def normalize_status(value: object) -> str:
    text = clean(value)
    if text in {"待审核", "已审核", "需修改"}:
        return text
    return "未标注"


def quality_flags(record: dict[str, object]) -> list[str]:
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
            record["publication_year"] is not None and record["publication_year"] > CURRENT_YEAR,
        ),
    ]
    return [name for name, failed in checks if failed]


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"source workbook not found: {SOURCE}")

    dataframe = pd.read_excel(SOURCE, sheet_name=SHEET_NAME).dropna(how="all")
    if len(dataframe.columns) != len(COLUMN_KEYS):
        raise ValueError(f"expected {len(COLUMN_KEYS)} columns, found {len(dataframe.columns)}")

    records: list[dict[str, object]] = []
    now = datetime.now(timezone.utc).isoformat()
    for index, row in dataframe.iterrows():
        record: dict[str, object] = {"id": f"poly-{index + 1:04d}"}
        for position, key in enumerate(COLUMN_KEYS):
            value = row.iloc[position]
            record[key] = parse_year(value) if key == "publication_year" else clean(value)
        record["review_status"] = normalize_status(record["review_status"])
        record["created_at"] = now
        record["updated_at"] = now
        record["data_quality_flags"] = quality_flags(record)
        records.append(record)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(records)} records to {OUTPUT}")


if __name__ == "__main__":
    main()
