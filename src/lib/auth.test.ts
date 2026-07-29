import { randomBytes, scryptSync } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { isAdminConfigured, verifyAdminPassword } from "./auth";

const environment = { ...process.env };

afterEach(() => {
  process.env = { ...environment };
});

function configureAdmin(password = "correct-password") {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  process.env.ADMIN_USERNAME = "administrator";
  process.env.ADMIN_PASSWORD_HASH = `scrypt$16384$8$1$${salt}$${hash}`;
  process.env.SESSION_SECRET = "test-session-secret";
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

  it("rejects malformed password hashes", async () => {
    process.env.ADMIN_USERNAME = "administrator";
    process.env.ADMIN_PASSWORD_HASH = "not-a-password-hash";
    process.env.SESSION_SECRET = "test-session-secret";

    await expect(verifyAdminPassword("administrator", "correct-password")).resolves.toBe(false);
  });
});
