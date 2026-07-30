import type { PolysaccharideRecord } from "./fields";
import { computeQualityFlags } from "./quality";
import {
  getDatabase,
  insertRecord,
  replaceRecord,
  selectRecordById,
  selectRecords,
} from "./sqlite";

export async function getRecords(): Promise<PolysaccharideRecord[]> {
  return selectRecords();
}

export async function getRecordById(id: string): Promise<PolysaccharideRecord | null> {
  return selectRecordById(id);
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
  return insertRecord(record);
}

export async function updateRecord(
  id: string,
  input: Partial<PolysaccharideRecord>,
): Promise<PolysaccharideRecord | null> {
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
