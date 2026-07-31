import type { PolysaccharideRecord } from "./fields";
import { computeQualityFlags } from "./quality";
import {
  getDatabase,
  insertRecord,
  replaceRecord,
  selectRecordById,
  selectRecords,
} from "./sqlite";
import {
  insertPostgresRecord,
  selectPostgresRecordById,
  selectPostgresRecords,
  updatePostgresRecord,
} from "./postgres";

type DatabaseEnvironment = Record<string, string | undefined>;

export function resolveDatabaseBackend(environment: DatabaseEnvironment = process.env) {
  return environment.DATABASE_URL?.trim() ? "postgres" : "sqlite";
}

function usesPostgres() {
  return resolveDatabaseBackend() === "postgres";
}

export async function getRecords(): Promise<PolysaccharideRecord[]> {
  return usesPostgres() ? selectPostgresRecords() : selectRecords();
}

export async function getRecordById(id: string): Promise<PolysaccharideRecord | null> {
  return usesPostgres() ? selectPostgresRecordById(id) : selectRecordById(id);
}

export async function getRecordsIncludingDeleted(): Promise<PolysaccharideRecord[]> {
  return usesPostgres()
    ? selectPostgresRecords({ includeDeleted: true })
    : selectRecords({ includeDeleted: true });
}

export async function getRecordByIdIncludingDeleted(
  id: string,
): Promise<PolysaccharideRecord | null> {
  return usesPostgres()
    ? selectPostgresRecordById(id, { includeDeleted: true })
    : selectRecordById(id, { includeDeleted: true });
}

export async function createRecord(input: PolysaccharideRecord): Promise<PolysaccharideRecord> {
  const now = new Date().toISOString();
  const record = {
    ...input,
    id: input.id || `poly-${Date.now()}`,
    created_at: now,
    updated_at: now,
    data_quality_flags: computeQualityFlags(input, new Date().getFullYear()),
  };
  return usesPostgres() ? insertPostgresRecord(record) : insertRecord(record);
}

export async function updateRecord(
  id: string,
  input: Partial<PolysaccharideRecord>,
): Promise<PolysaccharideRecord | null> {
  if (usesPostgres()) {
    return updatePostgresRecord(id, (existing) => {
      const {
        id: _inputId,
        created_at: _createdAt,
        updated_at: _updatedAt,
        data_quality_flags: _qualityFlags,
        ...editableFields
      } = input;
      const updated = {
        ...existing,
        ...editableFields,
        id,
        updated_at: new Date().toISOString(),
      };
      updated.data_quality_flags = computeQualityFlags(updated, new Date().getFullYear());
      return updated;
    });
  }
  const update = getDatabase().transaction(() => {
    const existing = selectRecordById(id);
    if (!existing) return null;
    const {
      id: _inputId,
      created_at: _createdAt,
      updated_at: _updatedAt,
      data_quality_flags: _qualityFlags,
      ...editableFields
    } = input;
    const updated = {
      ...existing,
      ...editableFields,
      id,
      updated_at: new Date().toISOString(),
    };
    updated.data_quality_flags = computeQualityFlags(updated, new Date().getFullYear());
    return replaceRecord(updated);
  });
  return update.immediate();
}
