import importedRecords from "../../data/import/polysaccharide-records.json";

import type { PolysaccharideRecord } from "./fields";
import { computeQualityFlags } from "./quality";
import { readRuntimeJson, updateRuntimeJson } from "./runtime-store";

const RECORD_STORE_FILE = "polysaccharide-records.json";
const seedRecords = () => JSON.parse(JSON.stringify(importedRecords)) as PolysaccharideRecord[];

export async function getRecords(): Promise<PolysaccharideRecord[]> {
  return readRuntimeJson(RECORD_STORE_FILE, seedRecords);
}

export async function getRecordById(id: string): Promise<PolysaccharideRecord | null> {
  return (await getRecords()).find((record) => record.id === id) ?? null;
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
  return updateRuntimeJson(RECORD_STORE_FILE, seedRecords, (records) => ({
    data: [record, ...records],
    result: record,
  }));
}

export async function updateRecord(
  id: string,
  input: Partial<PolysaccharideRecord>,
): Promise<PolysaccharideRecord | null> {
  return updateRuntimeJson(RECORD_STORE_FILE, seedRecords, (records) => {
    const existing = records.find((record) => record.id === id);
    if (!existing) return { data: records, result: null };
    const updated = { ...existing, ...input, id, updated_at: new Date().toISOString() };
    updated.data_quality_flags = computeQualityFlags(updated, new Date().getFullYear());
    return { data: records.map((record) => record.id === id ? updated : record), result: updated };
  });
}
