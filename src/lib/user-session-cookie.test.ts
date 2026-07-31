import { describe, expect, it } from "vitest";

import { USER_SESSION_COOKIE, userSessionCookieOptions } from "./user-session-cookie";

describe("user session cookie", () => {
  it("is opaque and protected from script access and cross-site requests", () => {
    expect(USER_SESSION_COOKIE).toBe("polysaccharide_user_session");
    expect(userSessionCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });
});
