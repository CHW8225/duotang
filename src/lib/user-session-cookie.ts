export const USER_SESSION_COOKIE = "polysaccharide_user_session";
export const USER_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function userSessionCookieOptions(production: boolean) {
  return {
    httpOnly: true as const,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
    maxAge: USER_SESSION_MAX_AGE_SECONDS,
  };
}
