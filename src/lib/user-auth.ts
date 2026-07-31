import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export type UserStatus = "pending" | "active" | "disabled";
export type EmailPurpose = "verify_email" | "reset_password";
export type AuthOutboundEmail =
  | { purpose: EmailPurpose; token: string; email: string }
  | { purpose: "registration_notice"; email: string };
export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AuthEmailToken = {
  id: string;
  userId: string;
  tokenHash: string;
  purpose: EmailPurpose;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};
export type UserSession = {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};
export type PublicUser = Pick<AuthUser, "id" | "email" | "status" | "emailVerifiedAt">;

export type UserAuthRepository = {
  createUser(user: AuthUser): Promise<void>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  updateUserStatus(id: string, status: UserStatus, verifiedAt?: string): Promise<void>;
  updatePassword(id: string, passwordHash: string, updatedAt: string): Promise<void>;
  insertEmailToken(token: AuthEmailToken): Promise<void>;
  consumeEmailToken(tokenHash: string, purpose: EmailPurpose, now: string): Promise<AuthEmailToken | null>;
  activateUserWithToken(tokenHash: string, now: string): Promise<boolean>;
  resetPasswordWithToken(tokenHash: string, passwordHash: string, now: string): Promise<boolean>;
  insertSession(session: UserSession): Promise<void>;
  findSession(tokenHash: string, now: string): Promise<(UserSession & { user: AuthUser }) | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
};

const VIRTUAL_PASSWORD_HASH = "scrypt$16384$8$1$00000000000000000000000000000000$dbc68c7513f8fc48a52f5fa3a5ca0572f4a837e6f5fcdad0174969beed686f171243fd36080cd2194ce896d1b64fc11859edf6999711bee6c11d1655f3ce81da";

export class AuthError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashUserPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64);
  return `scrypt$16384$8$1$${salt}$${key.toString("hex")}`;
}

export function verifyUserPassword(password: string, stored: string) {
  const [algorithm, cost, blockSize, parallelization, salt, expectedHex] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(cost), r: Number(blockSize), p: Number(parallelization),
    });
    return expected.length > 0 && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function publicUser(user: AuthUser): PublicUser {
  const { id, email, status, emailVerifiedAt } = user;
  return { id, email, status, emailVerifiedAt };
}

export function createUserAuthService(dependencies: {
  repository: UserAuthRepository;
  sendEmail: (message: AuthOutboundEmail) => Promise<void>;
  now?: () => Date;
  randomToken?: () => string;
  passwordVerifier?: (password: string, storedHash: string) => boolean;
  passwordHasher?: (password: string) => string;
}) {
  const now = dependencies.now ?? (() => new Date());
  const randomToken = dependencies.randomToken ?? (() => randomBytes(32).toString("base64url"));
  const passwordVerifier = dependencies.passwordVerifier ?? verifyUserPassword;
  const passwordHasher = dependencies.passwordHasher ?? hashUserPassword;

  async function issueToken(user: AuthUser, purpose: EmailPurpose, lifetimeMs: number) {
    const token = randomToken();
    const createdAt = now();
    await dependencies.repository.insertEmailToken({
      id: randomUUID(), userId: user.id, tokenHash: hashOpaqueToken(token), purpose,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + lifetimeMs).toISOString(), usedAt: null,
    });
    await dependencies.sendEmail({ purpose, token, email: user.email });
  }

  return {
    async register(rawEmail: string, password: string) {
      const email = normalizeEmail(rawEmail);
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new AuthError("EMAIL_INVALID", "请输入有效邮箱。");
      if (password.length < 12) throw new AuthError("PASSWORD_WEAK", "密码至少需要12个字符。");
      const candidatePasswordHash = passwordHasher(password);
      const existing = await dependencies.repository.findUserByEmail(email);
      if (existing) {
        if (existing.status === "pending") await issueToken(existing, "verify_email", 24 * 60 * 60 * 1000);
        else await dependencies.sendEmail({ purpose: "registration_notice", email });
        return { accepted: true as const };
      }
      const timestamp = now().toISOString();
      const user: AuthUser = {
        id: randomUUID(), email, passwordHash: candidatePasswordHash, status: "pending",
        emailVerifiedAt: null, createdAt: timestamp, updatedAt: timestamp,
      };
      await dependencies.repository.createUser(user);
      await issueToken(user, "verify_email", 24 * 60 * 60 * 1000);
      return { accepted: true as const };
    },
    async resendVerification(rawEmail: string) {
      const user = await dependencies.repository.findUserByEmail(normalizeEmail(rawEmail));
      if (user?.status === "pending") await issueToken(user, "verify_email", 24 * 60 * 60 * 1000);
    },
    async verifyEmail(token: string) {
      const activated = await dependencies.repository.activateUserWithToken(hashOpaqueToken(token), now().toISOString());
      if (!activated) throw new AuthError("TOKEN_INVALID", "验证链接无效或已过期。");
    },
    async login(rawEmail: string, password: string) {
      const user = await dependencies.repository.findUserByEmail(normalizeEmail(rawEmail));
      const passwordMatches = passwordVerifier(password, user?.passwordHash ?? VIRTUAL_PASSWORD_HASH);
      if (!user || !passwordMatches) {
        throw new AuthError("CREDENTIALS_INVALID", "邮箱或密码不正确。");
      }
      if (user.status === "pending") throw new AuthError("EMAIL_NOT_VERIFIED", "请先验证邮箱。");
      if (user.status === "disabled") throw new AuthError("ACCOUNT_DISABLED", "账号已停用。");
      const token = randomToken();
      const createdAt = now();
      await dependencies.repository.insertSession({
        tokenHash: hashOpaqueToken(token), userId: user.id, createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return { token, user: publicUser(user) };
    },
    async getSession(token: string) {
      if (!token) return null;
      const session = await dependencies.repository.findSession(hashOpaqueToken(token), now().toISOString());
      if (!session || session.user.status !== "active") return null;
      return publicUser(session.user);
    },
    async logout(token: string) {
      if (token) await dependencies.repository.deleteSession(hashOpaqueToken(token));
    },
    async requestPasswordReset(rawEmail: string) {
      const user = await dependencies.repository.findUserByEmail(normalizeEmail(rawEmail));
      if (user?.status === "active") await issueToken(user, "reset_password", 60 * 60 * 1000);
    },
    async resetPassword(token: string, password: string) {
      if (password.length < 12) throw new AuthError("PASSWORD_WEAK", "密码至少需要12个字符。");
      const reset = await dependencies.repository.resetPasswordWithToken(
        hashOpaqueToken(token), hashUserPassword(password), now().toISOString(),
      );
      if (!reset) throw new AuthError("TOKEN_INVALID", "重置链接无效或已过期。");
    },
  };
}

export function createInMemoryAuthRepository(): UserAuthRepository & {
  users: AuthUser[]; emailTokens: AuthEmailToken[]; sessions: UserSession[];
} {
  const users: AuthUser[] = [];
  const emailTokens: AuthEmailToken[] = [];
  const sessions: UserSession[] = [];
  return {
    users, emailTokens, sessions,
    async createUser(user) { users.push({ ...user }); },
    async findUserByEmail(email) { return users.find((user) => user.email === email) ?? null; },
    async findUserById(id) { return users.find((user) => user.id === id) ?? null; },
    async updateUserStatus(id, status, verifiedAt) {
      const user = users.find((candidate) => candidate.id === id);
      if (user) { user.status = status; if (verifiedAt) user.emailVerifiedAt = verifiedAt; user.updatedAt = verifiedAt ?? user.updatedAt; }
    },
    async updatePassword(id, passwordHash, updatedAt) {
      const user = users.find((candidate) => candidate.id === id);
      if (user) { user.passwordHash = passwordHash; user.updatedAt = updatedAt; }
    },
    async insertEmailToken(token) { emailTokens.push({ ...token }); },
    async consumeEmailToken(tokenHash, purpose, timestamp) {
      const token = emailTokens.find((candidate) => candidate.tokenHash === tokenHash && candidate.purpose === purpose);
      if (!token || token.usedAt || token.expiresAt <= timestamp) return null;
      token.usedAt = timestamp;
      return { ...token };
    },
    async activateUserWithToken(tokenHash, timestamp) {
      const token = emailTokens.find((candidate) => candidate.tokenHash === tokenHash && candidate.purpose === "verify_email");
      const user = token && users.find((candidate) => candidate.id === token.userId);
      if (!token || !user || token.usedAt || token.expiresAt <= timestamp) return false;
      token.usedAt = timestamp; user.status = "active"; user.emailVerifiedAt = timestamp; user.updatedAt = timestamp;
      return true;
    },
    async resetPasswordWithToken(tokenHash, passwordHash, timestamp) {
      const token = emailTokens.find((candidate) => candidate.tokenHash === tokenHash && candidate.purpose === "reset_password");
      const user = token && users.find((candidate) => candidate.id === token.userId);
      if (!token || !user || token.usedAt || token.expiresAt <= timestamp) return false;
      token.usedAt = timestamp; user.passwordHash = passwordHash; user.updatedAt = timestamp;
      for (let index = sessions.length - 1; index >= 0; index--) if (sessions[index].userId === user.id) sessions.splice(index, 1);
      return true;
    },
    async insertSession(session) { sessions.push({ ...session }); },
    async findSession(tokenHash, timestamp) {
      const session = sessions.find((candidate) => candidate.tokenHash === tokenHash && candidate.expiresAt > timestamp);
      const user = session && users.find((candidate) => candidate.id === session.userId);
      return session && user ? { ...session, user: { ...user } } : null;
    },
    async deleteSession(tokenHash) {
      const index = sessions.findIndex((candidate) => candidate.tokenHash === tokenHash);
      if (index >= 0) sessions.splice(index, 1);
    },
    async deleteUserSessions(userId) {
      for (let index = sessions.length - 1; index >= 0; index--) {
        if (sessions[index].userId === userId) sessions.splice(index, 1);
      }
    },
  };
}
