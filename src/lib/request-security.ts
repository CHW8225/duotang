import { normalizeEmail } from "./user-auth";

export function resolveClientIp(input: {
  directIp: string;
  forwardedFor?: string | null;
  trustedProxyIps: string[];
}) {
  if (!input.trustedProxyIps.includes(input.directIp)) return input.directIp;
  return input.forwardedFor?.split(",")[0]?.trim() || input.directIp;
}

export function resolveRequestIdentity(input: {
  production: boolean;
  configuredSecret?: string;
  presentedSecret?: string | null;
  realIp?: string | null;
}) {
  if (!input.production) return "local-development";
  if (!input.configuredSecret || input.presentedSecret !== input.configuredSecret || !input.realIp?.trim()) {
    throw new Error("Trusted proxy configuration is missing or invalid");
  }
  return input.realIp.trim();
}

export function createRateLimiter(config: { limit: number; windowMs: number }) {
  const counters = new Map<string, { count: number; resetAt: number }>();
  return {
    async consume(input: { operation: string; email: string; ip: string; now?: number }) {
      const timestamp = input.now ?? Date.now();
      const keys = [
        `${input.operation}:email:${normalizeEmail(input.email)}`,
        `${input.operation}:ip:${input.ip}`,
      ];
      const blocked = keys.map((key) => counters.get(key)).find((entry) => entry && entry.resetAt > timestamp && entry.count >= config.limit);
      if (blocked) return { allowed: false, retryAfterSeconds: Math.ceil((blocked.resetAt - timestamp) / 1000) };
      for (const key of keys) {
        const current = counters.get(key);
        counters.set(key, !current || current.resetAt <= timestamp
          ? { count: 1, resetAt: timestamp + config.windowMs }
          : { ...current, count: current.count + 1 });
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
