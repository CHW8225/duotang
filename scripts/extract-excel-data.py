from import_contract import MANIFEST, OUTPUT, build_manifest, source_records, write_json


def main() -> None:
    records, source_rows = source_records()
    write_json(OUTPUT, records)
    write_json(MANIFEST, build_manifest(source_rows))
    print(f"wrote {len(records)} records to {OUTPUT}")
    print(f"wrote import provenance to {MANIFEST}")


if __name__ == "__main__":
    main()
