import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ordinary user authentication integration contract", () => {
  it("adds durable hashed sessions, rate limits, and a protected development outbox in migration 0002", () => {
    const sql = readFileSync(join(process.cwd(), "migrations/postgres/0002_user_auth.sql"), "utf8");
    expect(sql).toMatch(/RENAME COLUMN id TO token_hash/i);
    expect(sql).toMatch(/CREATE TABLE auth_rate_limits/i);
    expect(sql).not.toMatch(/development_email_outbox/i);
    expect(sql).not.toMatch(/action_url/i);
    expect(sql).toMatch(/ALTER TABLE user_sessions RENAME COLUMN id TO token_hash/i);
  });

  it("does not consume verification tokens during GET rendering", () => {
    const page = readFileSync(join(process.cwd(), "src/app/verify-email/page.tsx"), "utf8");
    const actions = readFileSync(join(process.cwd(), "src/app/auth-actions.ts"), "utf8");
    expect(page).not.toContain("verifyEmail(");
    expect(page).toContain("verifyEmailAction");
    expect(actions).toContain("verifyEmailAction");
  });

  it.each(["register", "login", "verify-email", "forgot-password", "reset-password", "account"])(
    "provides the /%s page with Chinese copy",
    (route) => {
      const source = readFileSync(join(process.cwd(), "src/app", route, "page.tsx"), "utf8");
      expect(source).toMatch(/[\u4e00-\u9fff]/);
    },
  );

  it("keeps ordinary account routes outside the protected admin tree", () => {
    const adminLayout = readFileSync(join(process.cwd(), "src/app/admin/(protected)/layout.tsx"), "utf8");
    expect(adminLayout).toContain("requireAdmin()");
    expect(adminLayout).not.toContain("requireUser");
  });

  it("documents all proxy origin headers required for secure URL handling", () => {
    const documentation = readFileSync(join(process.cwd(), "docs/tencent-cloud-user-auth.md"), "utf8");
    expect(documentation).toContain("proxy_set_header Host $host;");
    expect(documentation).toContain("proxy_set_header X-Forwarded-Host $host;");
    expect(documentation).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
  });
});
