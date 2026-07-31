import { describe, expect, it } from "vitest";

import { createRateLimiter, resolveClientIp, resolveRequestIdentity } from "./request-security";

describe("request security", () => {
  it("ignores forwarded headers unless the direct proxy is trusted", () => {
    expect(resolveClientIp({ directIp: "203.0.113.8", forwardedFor: "1.2.3.4", trustedProxyIps: [] }))
      .toBe("203.0.113.8");
    expect(resolveClientIp({ directIp: "10.0.0.2", forwardedFor: "198.51.100.7, 10.0.0.1", trustedProxyIps: ["10.0.0.2"] }))
      .toBe("198.51.100.7");
  });

  it("fails closed for missing or mismatched production proxy configuration", () => {
    expect(() => resolveRequestIdentity({ production: true, configuredSecret: "", presentedSecret: "", realIp: "" }))
      .toThrow(/proxy/i);
    expect(() => resolveRequestIdentity({ production: true, configuredSecret: "expected", presentedSecret: "forged", realIp: "203.0.113.1" }))
      .toThrow(/proxy/i);
    expect(resolveRequestIdentity({ production: false, configuredSecret: "", presentedSecret: "", realIp: "" }))
      .toBe("local-development");
  });

  it("limits each operation by both normalized email and client IP", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    const input = { operation: "login", email: "A@EXAMPLE.COM", ip: "203.0.113.8", now: 0 };
    expect(await limiter.consume(input)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(await limiter.consume(input)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(await limiter.consume(input)).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(await limiter.consume({ ...input, email: "b@example.com" })).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });
});
