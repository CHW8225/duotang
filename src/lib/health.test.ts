import { describe, expect, it, vi } from "vitest";

import { checkReadiness, livenessPayload } from "./health";

describe("health endpoints", () => {
  it("liveness exposes no environment or dependency details", () => {
    expect(livenessPayload()).toEqual({ status: "ok" });
  });

  it("readiness reports only ready or unavailable", async () => {
    const ready = await checkReadiness({ query: vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] }) });
    const unavailable = await checkReadiness({ query: vi.fn().mockRejectedValue(new Error("postgresql://secret")) });
    expect(ready).toEqual({ status: 200, body: { status: "ready" } });
    expect(unavailable).toEqual({ status: 503, body: { status: "unavailable" } });
    expect(JSON.stringify(unavailable)).not.toContain("postgresql");
  });
});
