import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

type UpdateResult<T, Result> = { data: T; result: Result };
type RuntimeFile = "polysaccharide-records.json" | "admin-sessions.json";

const writeQueues = new Map<string, Promise<void>>();

function runtimeDirectory() {
  return process.env.RUNTIME_DATA_DIR ?? join(process.cwd(), "data", "runtime");
}

function runtimeFilePath(filename: RuntimeFile) {
  const directory = runtimeDirectory();
  return filename === "polysaccharide-records.json"
    ? join(/* turbopackIgnore: true */ directory, "polysaccharide-records.json")
    : join(/* turbopackIgnore: true */ directory, "admin-sessions.json");
}

async function readOrInitializeRuntimeJson<T>(filename: RuntimeFile, createInitialData: () => T): Promise<T> {
  const filePath = runtimeFilePath(filename);
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const initialData = createInitialData();
    await writeRuntimeJson(filename, initialData);
    return initialData;
  }
}

async function writeRuntimeJson<T>(filename: RuntimeFile, data: T) {
  const filePath = runtimeFilePath(filename);
  await mkdir(runtimeDirectory(), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    await rm(filePath, { force: true });
    await rename(temporaryPath, filePath);
  }
}

function enqueueRuntimeFileOperation<Result>(filename: RuntimeFile, operation: () => Promise<Result>): Promise<Result> {
  const previous = writeQueues.get(filename) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(operation);
  writeQueues.set(filename, task.then(() => undefined, () => undefined));
  return task;
}

export function readRuntimeJson<T>(filename: RuntimeFile, createInitialData: () => T): Promise<T> {
  return enqueueRuntimeFileOperation(filename, () => readOrInitializeRuntimeJson(filename, createInitialData));
}

export async function updateRuntimeJson<T, Result>(
  filename: RuntimeFile,
  createInitialData: () => T,
  update: (data: T) => UpdateResult<T, Result>,
): Promise<Result> {
  return enqueueRuntimeFileOperation(filename, async () => {
    const updated = update(await readOrInitializeRuntimeJson(filename, createInitialData));
    await writeRuntimeJson(filename, updated.data);
    return updated.result;
  });
}
