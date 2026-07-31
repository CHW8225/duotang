import { createHash } from "node:crypto";

import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";

export const MIGRATION_COLUMNS = [
  "id",
  ...FIELD_DEFINITIONS.map(({ key }) => key),
  "data_quality_flags",
  "created_at",
  "updated_at",
] as const;

type MigrationColumn = (typeof MIGRATION_COLUMNS)[number];
export type MigrationRecord = Pick<PolysaccharideRecord, MigrationColumn>;

function normalizeUtcTimestamp(value: unknown) {
  const match = String(value).match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00(?::?00)?)$/,
  );
  if (!match) return String(value);
  return `${match[1]}T${match[2]}.${(match[3] ?? "").padEnd(6, "0")}Z`;
}

function stableValue(value: unknown, column: MigrationColumn) {
  if (column === "created_at" || column === "updated_at") {
    return normalizeUtcTimestamp(value);
  }
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value === null) return "null";
  return String(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function serializeRecordForMigration(
  record: PolysaccharideRecord,
): MigrationRecord {
  return Object.fromEntries(
    MIGRATION_COLUMNS.map((column) => [column, record[column]]),
  ) as MigrationRecord;
}

export function buildSeedVerification(records: PolysaccharideRecord[]) {
  const ordered = [...records].sort((left, right) => left.id.localeCompare(right.id));
  const fieldHashes = Object.fromEntries(
    MIGRATION_COLUMNS.map((column) => [
      column,
      sha256(
        ordered
          .map((record) => `${record.id}\u001f${stableValue(record[column], column)}`)
          .join("\u001e"),
      ),
    ]),
  ) as Record<MigrationColumn, string>;
  const datasetHash = sha256(
    MIGRATION_COLUMNS.map((column) => `${column}:${fieldHashes[column]}`).join("\n"),
  );

  return { recordCount: ordered.length, fieldHashes, datasetHash };
}
