import { describe, expect, it } from "vitest";

import { createDevelopmentEmailSender, selectAuthEmailSender } from "./email-sender";

describe("development email sender", () => {
  it("keeps test messages only in process memory and does not log its token", async () => {
    const logged: string[] = [];
    const send = createDevelopmentEmailSender({
      log: (message) => logged.push(message),
      baseUrl: "http://localhost:3100",
    });
    await send({ purpose: "verify_email", email: "a@example.com", token: "secret-token" });
    expect(send.peekForTests()).toHaveLength(1);
    const queued = send.peekForTests()[0];
    expect(queued.purpose).toBe("verify_email");
    if (queued.purpose !== "registration_notice") expect(queued.token).toBe("secret-token");
    expect(logged.join(" ")).not.toContain("secret-token");
  });

  it("fails closed in production unless Tencent SES is selected", () => {
    expect(() => selectAuthEmailSender({ NODE_ENV: "production", AUTH_EMAIL_MODE: "development" }))
      .toThrow(/tencent-ses/i);
  });

  it.each([undefined, "http://database.example.cn", "not-a-url"])(
    "fails closed for invalid production APP_BASE_URL: %s",
    (baseUrl) => {
      expect(() => selectAuthEmailSender({
        NODE_ENV: "production",
        AUTH_EMAIL_MODE: "tencent-ses",
        APP_BASE_URL: baseUrl,
      })).toThrow(/APP_BASE_URL|https/i);
    },
  );
});
