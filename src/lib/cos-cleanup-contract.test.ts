import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";

describe("COS补偿清理与代理下载契约",()=>{
  it("0008包含持久化清理队列状态、重试与告警字段",()=>{const sql=readFileSync("migrations/postgres/0008_cos_attachments.sql","utf8");expect(sql).toMatch(/CREATE TABLE cos_cleanup_jobs/i);for(const field of ["object_key","attempt_count","status","last_error","next_attempt_at","alert_required"])expect(sql).toContain(field)});
  it("PG以SKIP LOCKED原子领取租约，SQLite以immediate领取",()=>{const migration=readFileSync("migrations/postgres/0008_cos_attachments.sql","utf8");const source=readFileSync("src/lib/cos-cleanup.ts","utf8");expect(migration).toContain("locked_until");expect(source).toMatch(/FOR UPDATE SKIP LOCKED/);expect(source).toMatch(/UPDATE cos_cleanup_jobs[\s\S]*status='processing'/);expect(source).toMatch(/transaction[\s\S]*immediate\(\)/);expect(source).toMatch(/locked_until[\s\S]*CURRENT_TIMESTAMP/)});
  it("补偿失败入队，清理成功或失败均更新状态并审计",()=>{const source=readFileSync("src/lib/cos-cleanup.ts","utf8");expect(source).toMatch(/enqueueCosCleanup/);expect(source).toMatch(/attachment_cleanup_success/);expect(source).toMatch(/attachment_cleanup_failed/);expect(source).toMatch(/alert_required/)});
  it("下载路由代理COS对象且不重定向或返回签名URL",()=>{const source=readFileSync("src/app/attachments/[id]/download/route.ts","utf8");expect(source).toMatch(/readAuthorizedAttachment/);expect(source).not.toMatch(/signedUrl|redirect\(/);expect(source).toMatch(/Content-Disposition/)});
  it("下载按IP与附件ID限流",()=>{const route=readFileSync("src/app/attachments/[id]/download/route.ts","utf8");const limiter=readFileSync("src/lib/attachment-download-rate-limit.ts","utf8");expect(route).toMatch(/consumeAttachmentDownloadRateLimit\(id\)/);expect(limiter).toMatch(/attachment-download:\$\{attachmentId\}:ip:\$\{ip\}/)});
  it("下载采用短授权、限时限量流与返回前复核，不跨COS读取持锁",()=>{const source=readFileSync("src/lib/attachment-repository.ts","utf8");expect(source).toMatch(/readAuthorizedAttachment[\s\S]*authorizePublicAttachment[\s\S]*store\.open[\s\S]*authorizePublicAttachment/);expect(source).not.toMatch(/FOR SHARE OF a,r/);expect(source).toMatch(/30_000/);expect(source).toMatch(/MAX_ATTACHMENT_BYTES/)});
});
