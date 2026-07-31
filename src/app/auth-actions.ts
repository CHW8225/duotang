"use server";

import { redirect } from "next/navigation";
import { AuthError, normalizeEmail } from "@/lib/user-auth";
import { clearUserSession, consumeAuthRateLimit, getUserAuthService, setUserSessionCookie } from "@/lib/auth-runtime";

function value(data:FormData,key:string){return String(data.get(key)??"");}
function fail(path:string,error:unknown):never { const message=error instanceof AuthError?error.message:"操作失败，请稍后重试。";redirect(`${path}${path.includes("?")?"&":"?"}error=${encodeURIComponent(message)}`); }

export async function registerAction(data:FormData){const email=normalizeEmail(value(data,"email"));if(!await consumeAuthRateLimit("register",email,3))redirect("/register?error=请求过于频繁，请稍后重试。");try{await getUserAuthService().register(email,value(data,"password"));}catch(e){fail("/register",e);}redirect("/login?notice=注册成功，请查收验证邮件。");}
export async function loginAction(data:FormData){const email=normalizeEmail(value(data,"email"));if(!await consumeAuthRateLimit("login",email,5))redirect("/login?error=登录尝试过多，请稍后重试。");try{const result=await getUserAuthService().login(email,value(data,"password"));await setUserSessionCookie(result.token);}catch(e){fail("/login",e);}redirect("/account");}
export async function verifyEmailAction(data:FormData){const token=value(data,"token");if(!await consumeAuthRateLimit("verify-email",token.slice(0,12),5))redirect("/verify-email?error=请求过于频繁，请稍后重试。");try{await getUserAuthService().verifyEmail(token);}catch(e){fail(`/verify-email?token=${encodeURIComponent(token)}&state=confirm`,e);}redirect("/login?notice=邮箱验证成功，请登录。");}
export async function resendVerificationAction(data:FormData){const email=normalizeEmail(value(data,"email"));if(!await consumeAuthRateLimit("resend-verification",email,3))redirect("/login?error=请求过于频繁，请稍后重试。");await getUserAuthService().resendVerification(email);redirect("/login?notice=如账号待验证，我们已重新发送邮件。");}
export async function forgotPasswordAction(data:FormData){const email=normalizeEmail(value(data,"email"));if(!await consumeAuthRateLimit("forgot-password",email,3))redirect("/forgot-password?error=请求过于频繁，请稍后重试。");await getUserAuthService().requestPasswordReset(email);redirect("/login?notice=如邮箱已注册，我们已发送重置邮件。");}
export async function resetPasswordAction(data:FormData){const token=value(data,"token");if(!await consumeAuthRateLimit("reset-password",hashForRate(token),5))redirect("/reset-password?error=请求过于频繁，请稍后重试。");try{await getUserAuthService().resetPassword(token,value(data,"password"));}catch(e){fail("/reset-password",e);}redirect("/login?notice=密码已重置，请重新登录。");}
function hashForRate(token:string){return token.slice(0,12);}
export async function logoutAction(){await clearUserSession();redirect("/");}
