import { randomBytes, scryptSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { createStoredAdminSession, getStoredAdminSession, isAdminConfigured, verifyAdminPassword } from "./auth";

const environment = { ...process.env };
const temporaryDirectories: string[] = [];

afterEach(async () => {
  try {
    const { closeDatabaseConnection } = await import("./sqlite");
    closeDatabaseConnection();
  } catch {
    // The RED phase intentionally runs before the SQLite module exists.
  }
  process.env = { ...environment };
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

function configureAdmin(password = "correct-password") {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  process.env.ADMIN_USERNAME = "administrator";
  process.env.ADMIN_PASSWORD_HASH = `scrypt$16384$8$1$${salt}$${hash}`;
  process.env.SESSION_SECRET = "test-session-secret";
}

async function useTemporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "polysaccharide-session-"));
  temporaryDirectories.push(directory);
  process.env.DATABASE_PATH = join(directory, "polysaccharide.sqlite3");
  return process.env.DATABASE_PATH;
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
    await useTemporaryDatabase();

    const session = await createStoredAdminSession("administrator");

    expect(session?.id).toHaveLength(43);
    await expect(getStoredAdminSession(session?.id ?? "")).resolves.toMatchObject({
      username: "administrator",
      authenticatedAt: expect.any(String),
    });
  });

  it("keeps sessions after a database reconnect", async () => {
    configureAdmin();
    await useTemporaryDatabase();
    const session = await createStoredAdminSession("administrator");
    const { closeDatabaseConnection } = await import("./sqlite");
    closeDatabaseConnection();

    const reloadedAuth = await import("./auth");

    await expect(reloadedAuth.getStoredAdminSession(session?.id ?? "")).resolves.toMatchObject({
      username: "administrator",
    });
  });

  it("deletes expired sessions during lookup", async () => {
    configureAdmin();
    const databasePath = await useTemporaryDatabase();
    await createStoredAdminSession("administrator");
    const database = new Database(databasePath);
    database.prepare(
      `INSERT INTO admin_sessions (id, username, authenticated_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    ).run(
      "expired-session",
      "administrator",
      "2020-01-01T00:00:00.000Z",
      "2020-01-01T01:00:00.000Z",
    );

    await expect(getStoredAdminSession("expired-session")).resolves.toBeNull();
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM admin_sessions WHERE id = ?")
        .get("expired-session"),
    ).toEqual({ count: 0 });
    database.close();
  });
});
