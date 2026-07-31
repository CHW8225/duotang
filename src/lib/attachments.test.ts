import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { describe,expect,it } from "vitest";
import { AttachmentError,createAttachmentObjectKey,safeContentDisposition,validateAttachmentUpload } from "./attachments";

async function validPng(){return sharp({create:{width:2,height:2,channels:4,background:"red"}}).png().toBuffer()}
async function validJpeg(){return sharp({create:{width:2,height:2,channels:3,background:"blue"}}).jpeg().toBuffer()}
async function validPdf(){const doc=await PDFDocument.create();doc.addPage([100,100]);return Buffer.from(await doc.save())}
const input=(name:string,mime:string,bytes:Buffer)=>({name,mime,bytes,description:"补充材料",rightsConfirmed:true});

describe("附件深度解析",()=>{
  it("接受可完整解析的PDF、PNG和JPEG",async()=>{await expect(validateAttachmentUpload(input("a.pdf","application/pdf",await validPdf()))).resolves.toMatchObject({mimeType:"application/pdf"});await expect(validateAttachmentUpload(input("a.png","image/png",await validPng()))).resolves.toMatchObject({mimeType:"image/png"});await expect(validateAttachmentUpload(input("a.jpg","image/jpeg",await validJpeg()))).resolves.toMatchObject({mimeType:"image/jpeg"});});
  it.each([["broken.pdf","application/pdf",Buffer.from("%PDF-1.7\n")],["broken.png","image/png",Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])],["broken.jpg","image/jpeg",Buffer.from([0xff,0xd8,0xff])]])("拒绝仅文件头或损坏文件 %s",async(name,mime,bytes)=>{await expect(validateAttachmentUpload(input(name,mime,bytes))).rejects.toThrow(AttachmentError)});
  it("拒绝图片后拼接HTML的多态文件",async()=>{await expect(validateAttachmentUpload(input("a.png","image/png",Buffer.concat([await validPng(),Buffer.from("<html>")])))).rejects.toThrow(/多余内容/);await expect(validateAttachmentUpload(input("a.jpg","image/jpeg",Buffer.concat([await validJpeg(),Buffer.from("<script>")])))).rejects.toThrow(/多余内容/)});
  it.each(["/OpenAction","/AA","/JavaScript","/JS","/Launch","/EmbeddedFiles"])("拒绝PDF主动内容标记 %s",async marker=>{const bytes=Buffer.concat([await validPdf(),Buffer.from(`\n${marker}\n`)]);await expect(validateAttachmentUpload(input("a.pdf","application/pdf",bytes))).rejects.toThrow(/主动内容/)});
  it.each(["/Java#53cript","/java#53cript","/Open#41ction","/Lau#6ech","/Embedded#46iles"])("规范化PDF名称转义后拒绝 %s",async marker=>{const bytes=Buffer.concat([await validPdf(),Buffer.from(`\n${marker}\n`)]);await expect(validateAttachmentUpload(input("a.pdf","application/pdf",bytes))).rejects.toThrow(/主动内容/)});
  it("限制解码图片像素",async()=>{const bytes=await sharp({create:{width:10001,height:10001,channels:3,background:"white"}}).png().toBuffer();await expect(validateAttachmentUpload(input("huge.png","image/png",bytes))).rejects.toThrow(/像素/)});
  it("保留业务层20MiB、版权及说明限制",async()=>{await expect(validateAttachmentUpload(input("a.pdf","application/pdf",Buffer.alloc(20*1024*1024+1)))).rejects.toThrow(/20 MB/);await expect(validateAttachmentUpload({...input("a.pdf","application/pdf",await validPdf()),rightsConfirmed:false})).rejects.toThrow(/版权/);await expect(validateAttachmentUpload({...input("a.pdf","application/pdf",await validPdf()),description:"a".repeat(501)})).rejects.toThrow(/500/)});
  it("对象键和下载文件名安全",()=>{const key=createAttachmentObjectKey("poly-0001",".pdf");expect(key).toMatch(/^records\/poly-0001\/[0-9a-f-]+\.pdf$/);const header=safeContentDisposition("附件\r\nX:1.pdf");expect(header).not.toContain("\r");expect(header).not.toContain("\n")});
});
