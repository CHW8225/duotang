import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabaseConnection, getDatabase } from "./sqlite";
import { createSqliteUserAuthRepository } from "./user-auth-repository";
import { hashOpaqueToken, hashUserPassword, type AuthUser } from "./user-auth";

describe("SQLite atomic authentication operations", () => {
  let directory = "";
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "auth-atomic-"));
    process.env.DATABASE_PATH = join(directory, "test.sqlite3");
    closeDatabaseConnection();
  });
  afterEach(() => { closeDatabaseConnection(); delete process.env.DATABASE_PATH; rmSync(directory, { recursive: true, force: true }); });

  async function seed() {
    const repository = createSqliteUserAuthRepository();
    const user: AuthUser = { id: "user-1", email: "a@example.com", passwordHash: hashUserPassword("old password value"), status: "pending", emailVerifiedAt: null, createdAt: "2026-07-31T00:00:00.000Z", updatedAt: "2026-07-31T00:00:00.000Z" };
    await repository.createUser(user);
    return repository;
  }

  it("rolls back token consumption when activation fails", async () => {
    const repository = await seed();
    await repository.insertEmailToken({ id: "token-1", userId: "user-1", tokenHash: hashOpaqueToken("verify"), purpose: "verify_email", expiresAt: "2026-08-01T00:00:00.000Z", usedAt: null, createdAt: "2026-07-31T00:00:00.000Z" });
    getDatabase().exec("CREATE TRIGGER fail_activation BEFORE UPDATE OF status ON users BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
    await expect(repository.activateUserWithToken(hashOpaqueToken("verify"), "2026-07-31T01:00:00.000Z")).rejects.toThrow(/forced failure/);
    expect((getDatabase().prepare("SELECT used_at FROM email_tokens WHERE id='token-1'").get() as {used_at:null}).used_at).toBeNull();
  });

  it("rolls back token consumption and preserves sessions when password update fails", async () => {
    const repository = await seed();
    await repository.updateUserStatus("user-1", "active", "2026-07-31T00:10:00.000Z");
    await repository.insertEmailToken({ id: "token-2", userId: "user-1", tokenHash: hashOpaqueToken("reset"), purpose: "reset_password", expiresAt: "2026-07-31T02:00:00.000Z", usedAt: null, createdAt: "2026-07-31T00:00:00.000Z" });
    await repository.insertSession({ tokenHash: "session-hash", userId: "user-1", createdAt: "2026-07-31T00:00:00.000Z", expiresAt: "2026-08-01T00:00:00.000Z" });
    getDatabase().exec("CREATE TRIGGER fail_password BEFORE UPDATE OF password_hash ON users BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
    await expect(repository.resetPasswordWithToken(hashOpaqueToken("reset"), hashUserPassword("new password value"), "2026-07-31T01:00:00.000Z")).rejects.toThrow(/forced failure/);
    expect((getDatabase().prepare("SELECT used_at FROM email_tokens WHERE id='token-2'").get() as {used_at:null}).used_at).toBeNull();
    expect((getDatabase().prepare("SELECT COUNT(*) count FROM user_sessions").get() as {count:number}).count).toBe(1);
  });
});
