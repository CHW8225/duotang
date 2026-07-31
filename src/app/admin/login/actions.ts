"use server";
import { redirect } from "next/navigation";
import { createAdminSession, verifyAdminPassword } from "@/lib/auth";
export type LoginState = { error?: string };
export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim(); const password = String(formData.get("password") ?? "");
  if (!await verifyAdminPassword(username, password)) return { error: "管理员用户名或密码不正确。" };
  await createAdminSession(username); redirect("/admin");
}
