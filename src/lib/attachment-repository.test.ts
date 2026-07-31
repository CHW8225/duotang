import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { closeDatabaseConnection,getDatabase } from "./sqlite";
import { getPublicAttachment,listRecordAttachments,persistUploadedAttachment,readAuthorizedAttachment,updateAttachment } from "./attachment-repository";
import type { AttachmentStore } from "./cos-store";
import { Readable } from "node:stream";

describe("SQLite附件仓库",()=>{
  beforeEach(async()=>{closeDatabaseConnection();process.env.DATABASE_PATH=join(await mkdtemp(join(tmpdir(),"attachments-")),"test.sqlite3")});
  afterEach(()=>{closeDatabaseConnection();delete process.env.DATABASE_PATH});
  const store=():AttachmentStore=>({put:vi.fn().mockResolvedValue(undefined),remove:vi.fn().mockResolvedValue(undefined),get:vi.fn().mockResolvedValue(Buffer.from("data")),open:vi.fn(),signedUrl:vi.fn()});
  const input=(n:number)=>({recordId:"poly-0001",objectKey:`records/poly-0001/${n}.pdf`,originalFilename:`附件${n}.pdf`,mimeType:"application/pdf",byteSize:8,description:"说明",isPublic:true,actor:"admin"});

  it("最多保留10个有效附件并写审计",async()=>{const s=store();for(let i=0;i<10;i++)await persistUploadedAttachment(input(i),s,Buffer.from("%PDF-1"));await expect(persistUploadedAttachment(input(10),s,Buffer.from("%PDF-1"))).rejects.toThrow(/10/);expect(await listRecordAttachments("poly-0001",true)).toHaveLength(10);expect(getDatabase().prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='attachment_upload'").get()).toEqual({count:10});});
  it("数据库失败会补偿删除COS对象",async()=>{const s=store();getDatabase().exec("CREATE TRIGGER fail_attachment_audit BEFORE INSERT ON audit_logs WHEN NEW.action='attachment_upload' BEGIN SELECT RAISE(ABORT,'audit failed'); END");await expect(persistUploadedAttachment(input(1),s,Buffer.from("%PDF-1"))).rejects.toThrow();expect(s.remove).toHaveBeenCalledWith(input(1).objectKey);expect(await listRecordAttachments("poly-0001",true)).toHaveLength(0);});
  it("补偿删除失败时持久化重试任务",async()=>{const s=store();vi.mocked(s.remove).mockRejectedValue(new Error("COS unavailable"));getDatabase().exec("CREATE TRIGGER fail_attachment_audit BEFORE INSERT ON audit_logs WHEN NEW.action='attachment_upload' BEGIN SELECT RAISE(ABORT,'audit failed'); END");await expect(persistUploadedAttachment(input(1),s,Buffer.from("%PDF-1"))).rejects.toThrow(/重试队列/);expect(getDatabase().prepare("SELECT object_key,status FROM cos_cleanup_jobs").get()).toEqual({object_key:input(1).objectKey,status:"pending"});});
  it("只有公开有效附件可下载，附件或记录软删后立即隐藏",async()=>{const s=store();const a=await persistUploadedAttachment(input(1),s,Buffer.from("%PDF-1"));expect(await getPublicAttachment(a.id)).not.toBeNull();await updateAttachment(a.id,"admin","撤下",false,true);expect(await getPublicAttachment(a.id)).toBeNull();const b=await persistUploadedAttachment(input(2),s,Buffer.from("%PDF-1"));getDatabase().prepare("UPDATE polysaccharide_records SET deleted_at=?,deleted_by=?,deletion_reason=? WHERE id=?").run(new Date().toISOString(),"admin","测试","poly-0001");expect(await getPublicAttachment(b.id)).toBeNull();});
  it("打开COS流后若复核失效则销毁流并拒绝返回",async()=>{const s=store(),a=await persistUploadedAttachment(input(1),s,Buffer.from("%PDF-1"));const stream=Readable.from([Buffer.from("data")]);vi.mocked(s.open).mockImplementation(async()=>{getDatabase().prepare("UPDATE record_attachments SET is_public=0 WHERE id=?").run(a.id);return{stream,size:4}});expect(await readAuthorizedAttachment(a.id,s)).toBeNull();expect(stream.destroyed).toBe(true);});
});
