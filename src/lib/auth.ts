import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AdminSession = { username: string; authenticatedAt: string };
type SessionPayload = AdminSession & { expiresAt: string };

const SESSION_COOKIE = "polysaccharide_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

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

function sign(value: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "").update(value).digest("base64url");
}

function encodeSession(session: SessionPayload) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string | undefined): AdminSession | null {
  if (!value || !isAdminConfigured()) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || signature !== sign(payload)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (session.username !== process.env.ADMIN_USERNAME || !session.authenticatedAt || !session.expiresAt || new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return { username: session.username, authenticatedAt: session.authenticatedAt };
  } catch { return null; }
}

export async function createAdminSession(username: string) {
  if (!isAdminConfigured() || username !== process.env.ADMIN_USERNAME) return;
  const authenticatedAt = new Date();
  const expiresAt = new Date(authenticatedAt.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession({ username, authenticatedAt: authenticatedAt.toISOString(), expiresAt: expiresAt.toISOString() }), { httpOnly: true, maxAge: SESSION_MAX_AGE_SECONDS, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

export async function getAdminSession() {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
