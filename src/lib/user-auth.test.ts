import { describe, expect, it } from "vitest";

import {
  AuthError,
  createInMemoryAuthRepository,
  createUserAuthService,
  hashUserPassword,
  hashOpaqueToken,
  normalizeEmail,
} from "./user-auth";

const now = new Date("2026-07-31T00:00:00.000Z");

function setup() {
  const repository = createInMemoryAuthRepository();
  const sent: { purpose: string; token?: string; email: string }[] = [];
  const service = createUserAuthService({
    repository,
    now: () => now,
    randomToken: (() => {
      let index = 0;
      return () => `token-${++index}`;
    })(),
    sendEmail: async (message) => { sent.push(message); },
  });
  return { repository, sent, service };
}

describe("ordinary user authentication", () => {
  it("normalizes email and creates a pending user with a hashed verification token", async () => {
    const { repository, sent, service } = setup();

    await service.register(" Researcher@Example.COM ", "correct horse battery staple");

    const user = await repository.findUserByEmail("researcher@example.com");
    expect(normalizeEmail(" Researcher@Example.COM ")).toBe("researcher@example.com");
    expect(user).toMatchObject({ email: "researcher@example.com", status: "pending" });
    expect(user?.passwordHash).not.toContain("correct horse battery staple");
    expect(sent[0]).toMatchObject({
      purpose: "verify_email",
      email: "researcher@example.com",
      token: "token-1",
    });
    expect(repository.emailTokens[0]).toMatchObject({
      tokenHash: hashOpaqueToken("token-1"),
      purpose: "verify_email",
      expiresAt: "2026-08-01T00:00:00.000Z",
    });
  });

  it("returns the same registration result without revealing whether an email exists", async () => {
    const { sent, service } = setup();
    await expect(service.register("a@example.com", "correct horse battery staple"))
      .resolves.toEqual({ accepted: true });
    await expect(service.register("a@example.com", "another correct password"))
      .resolves.toEqual({ accepted: true });
    expect(sent).toHaveLength(2);
    await service.verifyEmail("token-2");
    await expect(service.register("a@example.com", "another correct password"))
      .resolves.toEqual({ accepted: true });
    expect(sent).toHaveLength(3);
    expect(sent[2]).toEqual({ purpose: "registration_notice", email: "a@example.com" });
  });

  it("equalizes hashing and mail delivery across new, pending, and active registration paths", async () => {
    const repository = createInMemoryAuthRepository();
    const hashedPasswords: string[] = [];
    const sent: { purpose: string; token?: string; email: string }[] = [];
    let tokenIndex = 0;
    const service = createUserAuthService({
      repository,
      now: () => now,
      randomToken: () => `equalized-token-${++tokenIndex}`,
      passwordHasher: (password) => { hashedPasswords.push(password); return hashUserPassword(password); },
      sendEmail: async (message) => { sent.push(message); },
    });

    const created = await service.register("equal@example.com", "correct horse battery staple");
    const pending = await service.register("equal@example.com", "correct horse battery staple");
    await service.verifyEmail("equalized-token-2");
    const active = await service.register("equal@example.com", "correct horse battery staple");

    expect(created).toEqual({ accepted: true });
    expect(pending).toEqual(created);
    expect(active).toEqual(created);
    expect(hashedPasswords).toHaveLength(3);
    expect(sent.map(({ purpose }) => purpose)).toEqual([
      "verify_email",
      "verify_email",
      "registration_notice",
    ]);
    expect(sent[2]).toEqual({
      purpose: "registration_notice",
      email: "equal@example.com",
    });
    expect(repository.emailTokens).toHaveLength(2);
  });

  it("performs fixed-cost password verification for missing users and returns the same error", async () => {
    const repository = createInMemoryAuthRepository();
    const verifiedHashes: string[] = [];
    const service = createUserAuthService({
      repository,
      sendEmail: async () => {},
      now: () => now,
      passwordVerifier: (password, hash) => { verifiedHashes.push(hash); return false; },
    });
    await expect(service.login("missing@example.com", "wrong password"))
      .rejects.toMatchObject({ code: "CREDENTIALS_INVALID", message: "邮箱或密码不正确。" });
    expect(verifiedHashes).toHaveLength(1);
    expect(verifiedHashes[0]).toMatch(/^scrypt\$/);
  });

  it("activates a user once and rejects expired or reused verification tokens", async () => {
    const { repository, service } = setup();
    await service.register("a@example.com", "correct horse battery staple");
    await service.verifyEmail("token-1");
    expect((await repository.findUserByEmail("a@example.com"))?.status).toBe("active");
    await expect(service.verifyEmail("token-1")).rejects.toMatchObject({ code: "TOKEN_INVALID" });

    await repository.insertEmailToken({
      id: "expired",
      userId: (await repository.findUserByEmail("a@example.com"))!.id,
      tokenHash: hashOpaqueToken("expired"),
      purpose: "verify_email",
      expiresAt: "2026-07-30T23:59:59.000Z",
      createdAt: "2026-07-30T00:00:00.000Z",
      usedAt: null,
    });
    await expect(service.verifyEmail("expired")).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("rejects pending and disabled users and creates a hashed opaque session for active users", async () => {
    const { repository, service } = setup();
    await service.register("a@example.com", "correct horse battery staple");
    await expect(service.login("a@example.com", "correct horse battery staple"))
      .rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    await service.verifyEmail("token-1");
    const login = await service.login("A@example.com", "correct horse battery staple");
    expect(login.token).toBe("token-2");
    expect(repository.sessions[0].tokenHash).toBe(hashOpaqueToken("token-2"));
    expect(repository.sessions[0].tokenHash).not.toBe(login.token);

    await repository.updateUserStatus(login.user.id, "disabled");
    await expect(service.login("a@example.com", "correct horse battery staple"))
      .rejects.toMatchObject({ code: "ACCOUNT_DISABLED" });
  });

  it("logs out by deleting the hashed session and never accepts a raw token as a database key", async () => {
    const { repository, service } = setup();
    await service.register("a@example.com", "correct horse battery staple");
    await service.verifyEmail("token-1");
    const login = await service.login("a@example.com", "correct horse battery staple");
    expect(await service.getSession(login.token)).toMatchObject({ email: "a@example.com" });
    await service.logout(login.token);
    expect(await service.getSession(login.token)).toBeNull();
  });

  it("uses a one-hour single-use reset token and invalidates existing sessions", async () => {
    const { repository, sent, service } = setup();
    await service.register("a@example.com", "correct horse battery staple");
    await service.verifyEmail("token-1");
    const login = await service.login("a@example.com", "correct horse battery staple");
    await service.requestPasswordReset("a@example.com");
    expect(sent.at(-1)).toMatchObject({ purpose: "reset_password", token: "token-3" });
    expect(repository.emailTokens.at(-1)?.expiresAt).toBe("2026-07-31T01:00:00.000Z");

    await service.resetPassword("token-3", "new correct horse battery staple");
    expect(await service.getSession(login.token)).toBeNull();
    await expect(service.resetPassword("token-3", "another correct password"))
      .rejects.toMatchObject({ code: "TOKEN_INVALID" });
    await expect(service.login("a@example.com", "correct horse battery staple"))
      .rejects.toBeInstanceOf(AuthError);
    await expect(service.login("a@example.com", "new correct horse battery staple"))
      .resolves.toMatchObject({ user: { status: "active" } });
  });
});
