import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
describe("COS附件契约",()=>{
  it("migration 0008约束附件并发上限和可见状态",()=>{const sql=readFileSync("migrations/postgres/0008_cos_attachments.sql","utf8");expect(sql).toMatch(/attachment_slots/i);expect(sql).toMatch(/CHECK[\s\S]*slot_number[\s\S]*BETWEEN 1 AND 10/i);expect(sql).toMatch(/UNIQUE[\s\S]*record_id[\s\S]*slot_number/i);expect(sql).toMatch(/upload_status[\s\S]*pending[\s\S]*ready/i)});
  it("COS适配仅从环境变量读取凭据并支持应用代理读取",()=>{const source=readFileSync("src/lib/cos-store.ts","utf8");expect(source).toMatch(/TENCENT_COS_SECRET_ID/);expect(source).toMatch(/TENCENT_COS_SECRET_KEY/);expect(source).toMatch(/TENCENT_COS_BUCKET/);expect(source).toMatch(/getObject/);expect(source).not.toMatch(/console\.log/)});
  it("代理授权排除私有、附件软删和记录软删",()=>{const source=readFileSync("src/lib/attachment-repository.ts","utf8");expect(source).toMatch(/is_public[\s\S]*rights_confirmed_at/i);expect(source).toMatch(/a\.deleted_at IS NULL/i);expect(source).toMatch(/r\.deleted_at IS NULL/i);expect(source).not.toMatch(/getPublicAttachment\(objectKey/)});
});
