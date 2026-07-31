import json
from typing import Any

from import_contract import (
    COLUMN_KEYS,
    MANIFEST,
    OUTPUT,
    build_manifest,
    source_records,
)


def load_json(path: Any) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    expected_records, source_rows = source_records()
    actual_records = load_json(OUTPUT)
    actual_manifest = load_json(MANIFEST)

    if len(actual_records) != 772:
        raise AssertionError(f"expected 772 records, found {len(actual_records)}")
    actual_ids = [record["id"] for record in actual_records]
    if len(set(actual_ids)) != len(actual_ids):
        raise AssertionError("generated record ids are not unique")

    for expected, actual in zip(expected_records, actual_records, strict=True):
        if expected["id"] != actual.get("id"):
            raise AssertionError(
                f"id mismatch: expected {expected['id']}, found {actual.get('id')}"
            )
        for key in COLUMN_KEYS:
            if expected[key] != actual.get(key):
                raise AssertionError(
                    f"{expected['id']} field {key!r} differs: "
                    f"expected {expected[key]!r}, found {actual.get(key)!r}"
                )

    expected_manifest = build_manifest(source_rows)
    if actual_manifest != expected_manifest:
        raise AssertionError("import manifest does not match the source workbook")

    print(
        "verified 772 records, 42 fields, unique ids, source rows, "
        "and cell-by-cell workbook fidelity"
    )


if __name__ == "__main__":
    main()
