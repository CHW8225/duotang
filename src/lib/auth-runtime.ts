import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { selectAuthEmailSender } from "./email-sender";
import { getPostgresPool } from "./postgres";
import { resolveRequestIdentity } from "./request-security";
import { getDatabase } from "./sqlite";
import { createUserAuthService, hashOpaqueToken } from "./user-auth";
import { getUserAuthRepository } from "./user-auth-repository";
import { USER_SESSION_COOKIE, userSessionCookieOptions } from "./user-session-cookie";
import { resolveDatabaseBackend } from "./db";

export function getUserAuthService() {
  return createUserAuthService({ repository: getUserAuthRepository(), sendEmail: selectAuthEmailSender() });
}

export async function getCurrentUser() {
  const token=(await cookies()).get(USER_SESSION_COOKIE)?.value ?? "";
  if(!token) return null;
  return getUserAuthService().getSession(token);
}

export async function requireUser() {
  const user=await getCurrentUser();
  if(!user) redirect("/login");
  return user;
}

export async function setUserSessionCookie(token:string) {
  (await cookies()).set(USER_SESSION_COOKIE,token,userSessionCookieOptions(process.env.NODE_ENV==="production"));
}

export async function clearUserSession() {
  const store=await cookies();
  const token=store.get(USER_SESSION_COOKIE)?.value ?? "";
  await getUserAuthService().logout(token);
  store.delete(USER_SESSION_COOKIE);
}

export async function requestClientIp() {
  const h=await headers();
  return resolveRequestIdentity({production:process.env.NODE_ENV==="production",configuredSecret:process.env.TRUSTED_PROXY_HEADER_SECRET,presentedSecret:h.get("x-polysaccharide-proxy-secret"),realIp:h.get("x-real-ip")});
}

export async function consumeAuthRateLimit(operation:string,email:string,limit=5) {
  const ip=await requestClientIp(); const now=new Date(); const reset=new Date(now.getTime()+15*60*1000);
  const keys=[`${operation}:email:${email.trim().toLowerCase()}`,`${operation}:ip:${ip}`];
  if(resolveDatabaseBackend()==="postgres"){
    for(const key of keys){const r=await getPostgresPool().query(`INSERT INTO auth_rate_limits(key,attempt_count,reset_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET attempt_count=CASE WHEN auth_rate_limits.reset_at<=CURRENT_TIMESTAMP THEN 1 ELSE auth_rate_limits.attempt_count+1 END,reset_at=CASE WHEN auth_rate_limits.reset_at<=CURRENT_TIMESTAMP THEN EXCLUDED.reset_at ELSE auth_rate_limits.reset_at END,updated_at=CURRENT_TIMESTAMP RETURNING attempt_count,reset_at`,[hashOpaqueToken(key),reset.toISOString()]);if(Number(r.rows[0].attempt_count)>limit) return false;}
  }else{
    const db=getDatabase(); for(const key of keys){const hashed=hashOpaqueToken(key);const row=db.prepare("SELECT * FROM auth_rate_limits WHERE key=?").get(hashed) as {attempt_count:number;reset_at:string}|undefined;const count=!row||row.reset_at<=now.toISOString()?1:row.attempt_count+1;db.prepare("INSERT OR REPLACE INTO auth_rate_limits VALUES(?,?,?,?)").run(hashed,count,!row||row.reset_at<=now.toISOString()?reset.toISOString():row.reset_at,now.toISOString());if(count>limit)return false;}
  }
  return true;
}
