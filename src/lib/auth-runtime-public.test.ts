import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("公开页面认证状态读取",()=>{
  it("无会话 cookie 时不初始化邮件发送器",async()=>{
    const source=await readFile(new URL("./auth-runtime.ts",import.meta.url),"utf8");
    expect(source).toMatch(/const token[\s\S]*if\s*\(!token\)\s*return null;[\s\S]*getUserAuthService\(\)\.getSession/);
  });
});
