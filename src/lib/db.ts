import type { PolysaccharideRecord } from "./fields";
import { computeQualityFlags } from "./quality";
import {
  getDatabase,
  insertRecord,
  insertRecordWithAudit,
  replaceRecord,
  selectRecordById,
  selectRecords,
  softDeleteRecord as softDeleteSqliteRecord,
  restoreSqliteRecord,
  updateRecordWithAudit,
} from "./sqlite";
import {
  insertPostgresRecord,
  selectPostgresRecordById,
  selectPostgresRecords,
  updatePostgresRecord,
  createPostgresRecordWithAudit,
  updatePostgresRecordWithAudit,
  softDeletePostgresRecord,
  restorePostgresRecord,
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

export async function createRecord(input: PolysaccharideRecord, actorId?: string): Promise<PolysaccharideRecord> {
  const now = new Date().toISOString();
  const record = {
    ...input,
    id: input.id || `poly-${Date.now()}`,
    created_at: now,
    updated_at: now,
    data_quality_flags: computeQualityFlags(input, new Date().getFullYear()),
  };
  if (!actorId) return usesPostgres() ? insertPostgresRecord(record) : insertRecord(record);
  return usesPostgres()
    ? createPostgresRecordWithAudit(record, actorId)
    : insertRecordWithAudit(record, actorId);
}

export async function updateRecord(
  id: string,
  input: Partial<PolysaccharideRecord>,
  actorId?: string,
): Promise<PolysaccharideRecord | null> {
  const changedFieldNames: Record<string, true> = {};
  if (usesPostgres()) {
    const update = (existing: PolysaccharideRecord) => {
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
      Object.keys(editableFields).forEach((key) => {
        const field = key as keyof PolysaccharideRecord;
        if (existing[field] !== (editableFields as Record<string, unknown>)[key]) changedFieldNames[key] = true;
      });
      updated.data_quality_flags = computeQualityFlags(updated, new Date().getFullYear());
      return updated;
    };
    return actorId
      ? updatePostgresRecordWithAudit(id, update, actorId, changedFieldNames)
      : updatePostgresRecord(id, update);
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
    Object.keys(editableFields).forEach((key) => {
      const field = key as keyof PolysaccharideRecord;
      if (existing[field] !== (editableFields as Record<string, unknown>)[key]) changedFieldNames[key] = true;
    });
    updated.data_quality_flags = computeQualityFlags(updated, new Date().getFullYear());
    return actorId
      ? updateRecordWithAudit(updated, actorId, changedFieldNames)
      : replaceRecord(updated);
  });
  return update.immediate();
}

export async function softDeleteRecord(
  id: string,
  admin: string,
  reason: string,
  expectedName: string,
) {
  return usesPostgres()
    ? softDeletePostgresRecord(id, admin, reason, expectedName)
    : softDeleteSqliteRecord(id, admin, reason, expectedName);
}

export async function restoreRecord(id: string, admin: string) {
  return usesPostgres()
    ? restorePostgresRecord(id, admin)
    : restoreSqliteRecord(id, admin);
}
