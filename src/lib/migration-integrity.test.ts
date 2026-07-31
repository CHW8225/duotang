import { describe, expect, it } from "vitest";

import records from "../../data/import/polysaccharide-records.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import {
  buildSeedVerification,
  serializeRecordForMigration,
} from "./migration-integrity";

describe("PostgreSQL seed integrity", () => {
  it("verifies all 772 records and every scientific field", () => {
    const verification = buildSeedVerification(records as PolysaccharideRecord[]);

    expect(verification.recordCount).toBe(772);
    expect(Object.keys(verification.fieldHashes)).toEqual([
      "id",
      ...FIELD_DEFINITIONS.map(({ key }) => key),
      "data_quality_flags",
      "created_at",
      "updated_at",
    ]);
    for (const hash of Object.values(verification.fieldHashes)) {
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(verification.datasetHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces deterministic hashes regardless of input order", () => {
    const source = records as PolysaccharideRecord[];

    expect(buildSeedVerification([...source].reverse())).toEqual(
      buildSeedVerification(source),
    );
  });

  it("hashes equivalent PostgreSQL UTC timestamp representations equally", () => {
    const [source] = records as PolysaccharideRecord[];
    const postgresText = {
      ...source,
      created_at: source.created_at.replace("T", " ").replace("+00:00", "+00"),
      updated_at: source.updated_at.replace("T", " ").replace("+00:00", "+00"),
    };

    expect(buildSeedVerification([postgresText])).toEqual(
      buildSeedVerification([source]),
    );
  });

  it("preserves actual seed microseconds while treating +00:00 and Z as equal", () => {
    const source = records as PolysaccharideRecord[];
    expect(source.every((record) =>
      /\.\d{6}\+00:00$/.test(record.created_at)
      && /\.\d{6}\+00:00$/.test(record.updated_at),
    )).toBe(true);
    const postgresTarget = source.map((record) => ({
      ...record,
      created_at: record.created_at.replace("+00:00", "Z"),
      updated_at: record.updated_at.replace("+00:00", "Z"),
    }));

    const sourceVerification = buildSeedVerification(source);
    const targetVerification = buildSeedVerification(postgresTarget);

    expect(targetVerification.fieldHashes.created_at).toBe(
      sourceVerification.fieldHashes.created_at,
    );
    expect(targetVerification.fieldHashes.updated_at).toBe(
      sourceVerification.fieldHashes.updated_at,
    );
    expect(targetVerification.datasetHash).toBe(sourceVerification.datasetHash);
  });

  it("serializes arrays and nulls without changing scientific values", () => {
    const [source] = records as PolysaccharideRecord[];
    const serialized = serializeRecordForMigration(source);

    expect(serialized.id).toBe(source.id);
    expect(serialized.publication_year).toBe(source.publication_year);
    expect(serialized.data_quality_flags).toEqual(source.data_quality_flags);
    expect(Object.keys(serialized)).toHaveLength(FIELD_DEFINITIONS.length + 4);
  });
});
