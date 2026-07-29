import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readRuntimeJson, updateRuntimeJson } from "./runtime-store";

export type AdminSession = { username: string; authenticatedAt: string };
export type StoredAdminSession = AdminSession & { id: string; expiresAt: string };

const SESSION_COOKIE = "polysaccharide_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SESSION_STORE_FILE = "admin-sessions.json";

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH && process.env.SESSION_SECRET);
}

function parsePasswordHash(value: string) {
  const [algorithm, cost, blockSize, parallelization, salt, derivedKey] = value.split("$");
  if (algorithm !== "scrypt" || !salt || !derivedKey) return null;
  const N = Number(cost); const r = Number(blockSize); const p = Number(parallelization);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < 2 || r < 1 || p < 1) return null;
  const expected = Buffer.from(derivedKey, "hex");
  return expected.length > 0 ? { N, r, p, salt, expected } : null;
}

export async function verifyAdminPassword(username: string, password: string) {
  if (!isAdminConfigured() || username !== process.env.ADMIN_USERNAME || password.length === 0) return false;
  const parsed = parsePasswordHash(process.env.ADMIN_PASSWORD_HASH ?? "");
  if (!parsed) return false;
  try {
    const actual = scryptSync(password, parsed.salt, parsed.expected.length, { N: parsed.N, r: parsed.r, p: parsed.p });
    return actual.length === parsed.expected.length && timingSafeEqual(actual, parsed.expected);
  } catch { return false; }
}

function currentSessions(sessions: StoredAdminSession[]) {
  return sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
}

export async function createStoredAdminSession(username: string): Promise<StoredAdminSession | null> {
  if (!isAdminConfigured() || username !== process.env.ADMIN_USERNAME) return null;
  const authenticatedAt = new Date();
  const session = {
    id: randomBytes(32).toString("base64url"),
    username,
    authenticatedAt: authenticatedAt.toISOString(),
    expiresAt: new Date(authenticatedAt.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
  };
  return updateRuntimeJson(SESSION_STORE_FILE, () => [] as StoredAdminSession[], (sessions) => ({
    data: [...currentSessions(sessions), session],
    result: session,
  }));
}

export async function getStoredAdminSession(id: string): Promise<StoredAdminSession | null> {
  if (!id || !isAdminConfigured()) return null;
  const sessions = await readRuntimeJson(SESSION_STORE_FILE, () => [] as StoredAdminSession[]);
  const session = currentSessions(sessions).find((candidate) => candidate.id === id) ?? null;
  return session?.username === process.env.ADMIN_USERNAME ? session : null;
}

export async function createAdminSession(username: string) {
  if (!isAdminConfigured() || username !== process.env.ADMIN_USERNAME) return;
  const session = await createStoredAdminSession(username);
  if (!session) return;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, { httpOnly: true, maxAge: SESSION_MAX_AGE_SECONDS, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

export async function getAdminSession() {
  const session = await getStoredAdminSession((await cookies()).get(SESSION_COOKIE)?.value ?? "");
  return session ? { username: session.username, authenticatedAt: session.authenticatedAt } : null;
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
