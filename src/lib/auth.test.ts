import { randomBytes, scryptSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createStoredAdminSession, getStoredAdminSession, isAdminConfigured, verifyAdminPassword } from "./auth";

const environment = { ...process.env };
const runtimeDirectories: string[] = [];

afterEach(async () => {
  process.env = { ...environment };
  await Promise.all(runtimeDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

function configureAdmin(password = "correct-password") {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  process.env.ADMIN_USERNAME = "administrator";
  process.env.ADMIN_PASSWORD_HASH = `scrypt$16384$8$1$${salt}$${hash}`;
  process.env.SESSION_SECRET = "test-session-secret";
}

async function useTemporaryRuntimeDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "polysaccharide-session-"));
  runtimeDirectories.push(directory);
  process.env.RUNTIME_DATA_DIR = directory;
}

describe("admin authentication", () => {
  it("requires all administrator environment variables", () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.SESSION_SECRET;

    expect(isAdminConfigured()).toBe(false);
  });

  it("accepts only the configured username and scrypt-hashed password", async () => {
    configureAdmin();

    await expect(verifyAdminPassword("administrator", "correct-password")).resolves.toBe(true);
    await expect(verifyAdminPassword("administrator", "wrong-password")).resolves.toBe(false);
    await expect(verifyAdminPassword("other-user", "correct-password")).resolves.toBe(false);
  });

  it("accepts a valid scrypt hash with escaped separators", async () => {
    configureAdmin();
    process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH?.replaceAll("$", "\\$");

    await expect(verifyAdminPassword("administrator", "correct-password")).resolves.toBe(true);
  });

  it("rejects a valid scrypt hash with mixed separator escaping", async () => {
    configureAdmin();
    process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH?.replace("$", "\\$");

    await expect(verifyAdminPassword("administrator", "correct-password")).resolves.toBe(false);
  });

  it("rejects malformed password hashes", async () => {
    process.env.ADMIN_USERNAME = "administrator";
    process.env.ADMIN_PASSWORD_HASH = "not-a-password-hash";
    process.env.SESSION_SECRET = "test-session-secret";

    await expect(verifyAdminPassword("administrator", "correct-password")).resolves.toBe(false);
  });

  it("stores sessions server-side and resolves them from an opaque id", async () => {
    configureAdmin();
    await useTemporaryRuntimeDirectory();

    const session = await createStoredAdminSession("administrator");

    expect(session?.id).toHaveLength(43);
    await expect(getStoredAdminSession(session?.id ?? "")).resolves.toMatchObject({
      username: "administrator",
      authenticatedAt: expect.any(String),
    });
  });
});
