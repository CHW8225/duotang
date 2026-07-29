import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const originalRuntimeDirectory = process.env.RUNTIME_DATA_DIR;
const runtimeDirectories: string[] = [];

afterEach(async () => {
  vi.resetModules();
  if (originalRuntimeDirectory === undefined) delete process.env.RUNTIME_DATA_DIR;
  else process.env.RUNTIME_DATA_DIR = originalRuntimeDirectory;
  await Promise.all(runtimeDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

async function useTemporaryRuntimeDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "polysaccharide-db-"));
  runtimeDirectories.push(directory);
  process.env.RUNTIME_DATA_DIR = directory;
}

describe("runtime record database", () => {
  it("does not overwrite a concurrent first update with seed data", async () => {
    await useTemporaryRuntimeDirectory();
    const { readRuntimeJson, updateRuntimeJson } = await import("./runtime-store");

    await Promise.all([
      readRuntimeJson("admin-sessions.json", () => ["seed"]),
      updateRuntimeJson("admin-sessions.json", () => ["seed"], () => ({
        data: ["created"],
        result: undefined,
      })),
    ]);

    await expect(readRuntimeJson("admin-sessions.json", () => [])).resolves.toEqual(["created"]);
  });

  it("keeps created records after a module-like reload", async () => {
    await useTemporaryRuntimeDirectory();
    const database = await import("./db");
    const [seedRecord] = await database.getRecords();
    const created = await database.createRecord({
      ...seedRecord,
      id: "persistent-record",
      standard_name: "Persisted record",
      created_at: "",
      updated_at: "",
    });

    vi.resetModules();
    const reloadedDatabase = await import("./db");

    await expect(reloadedDatabase.getRecordById(created.id)).resolves.toMatchObject({
      standard_name: "Persisted record",
    });
  });
});
