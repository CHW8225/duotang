import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES } from "./attachments";

describe("附件上传链路容量配置",()=>{
  it("Next.js 16 Server Action允许22mb请求体",()=>{
    const source=readFileSync("next.config.ts","utf8");
    expect(source).toMatch(/experimental\s*:\s*\{[\s\S]*serverActions\s*:\s*\{[\s\S]*bodySizeLimit\s*:\s*["']22mb["']/);
  });

  it("Nginx部署文档允许22m请求体",()=>{
    const source=readFileSync("docs/tencent-cloud-user-auth.md","utf8");
    expect(source).toMatch(/location \/\s*\{[\s\S]*client_max_body_size\s+22m\s*;/);
  });

  it("业务文件大小上限仍严格为20MiB",()=>{
    expect(MAX_ATTACHMENT_BYTES).toBe(20*1024*1024);
  });
});
