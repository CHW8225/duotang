import { timingSafeEqual } from "node:crypto";

export function authorizeCronRequest(
  authorization: string | null,
  environment: Record<string, string | undefined> = process.env,
) {
  const expected = environment.CRON_SECRET?.trim();
  const prefix = "Bearer ";
  if (!expected || !authorization?.startsWith(prefix)) return false;
  const actual = authorization.slice(prefix.length);
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
