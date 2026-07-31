import { describe, expect, it } from "vitest";
import { authorizeCronRequest } from "./cron-auth";

describe("CVM cron 鉴权", () => {
  it("只接受与 CRON_SECRET 完全一致的 Bearer token", () => {
    expect(authorizeCronRequest("Bearer correct", { CRON_SECRET: "correct" })).toBe(true);
    expect(authorizeCronRequest("Bearer wrong", { CRON_SECRET: "correct" })).toBe(false);
    expect(authorizeCronRequest(null, { CRON_SECRET: "correct" })).toBe(false);
    expect(authorizeCronRequest("Bearer correct", {})).toBe(false);
  });
});
