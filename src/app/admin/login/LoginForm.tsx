"use client";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";
const initialState: LoginState = {};
export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);
  return <form action={action} className="login-form"><label className="admin-form-field"><span>用户名</span><input autoComplete="username" name="username" required /></label><label className="admin-form-field"><span>密码</span><input autoComplete="current-password" name="password" required type="password" /></label>{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}<button className="button button--primary" disabled={pending} type="submit">{pending ? "登录中..." : "登录"}</button></form>;
}
