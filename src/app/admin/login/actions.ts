"use server";
import { redirect } from "next/navigation";
import { createAdminSession, verifyAdminPassword } from "@/lib/auth";
export type LoginState = { error?: string };
export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim(); const password = String(formData.get("password") ?? "");
  if (!await verifyAdminPassword(username, password)) return { error: "The administrator username or password is incorrect." };
  await createAdminSession(username); redirect("/admin");
}
