import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_DESCRIPTION = 500;

export class AttachmentError extends Error {}

type UploadInput = { name:string; mime:string; bytes:Buffer; description:string; rightsConfirmed:boolean };
const MAX_IMAGE_PIXELS=25_000_000;
const allowed = new Map([
  [".pdf", { mime:"application/pdf", magic:(b:Buffer)=>b.subarray(0,5).toString()==="%PDF-" }],
  [".png", { mime:"image/png", magic:(b:Buffer)=>b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) }],
  [".jpg", { mime:"image/jpeg", magic:(b:Buffer)=>b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff }],
  [".jpeg", { mime:"image/jpeg", magic:(b:Buffer)=>b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff }],
]);

function assertExactImageEnd(bytes:Buffer,extension:string){
  if(extension===".png"){
    let offset=8,ended=false;
    while(offset+12<=bytes.length){const size=bytes.readUInt32BE(offset);const end=offset+12+size;if(end>bytes.length)throw new AttachmentError("PNG 结构损坏");const type=bytes.subarray(offset+4,offset+8).toString("ascii");offset=end;if(type==="IEND"){ended=true;break;}}
    if(!ended||offset!==bytes.length)throw new AttachmentError("图片结尾存在多余内容");
  }else if(bytes.length<2||bytes[bytes.length-2]!==0xff||bytes[bytes.length-1]!==0xd9)throw new AttachmentError("图片结尾存在多余内容");
}

async function parseImage(bytes:Buffer,extension:string){
  assertExactImageEnd(bytes,extension);try{const metadata=await sharp(bytes,{limitInputPixels:false,failOn:"error"}).metadata();if(!metadata.width||!metadata.height||metadata.width*metadata.height>MAX_IMAGE_PIXELS)throw new AttachmentError("图片像素超过安全上限");await sharp(bytes,{limitInputPixels:MAX_IMAGE_PIXELS,failOn:"error"}).toBuffer();}catch(error){if(error instanceof AttachmentError)throw error;throw new AttachmentError("图片结构损坏或无法完整解码");}
}

async function parsePdf(bytes:Buffer){
  const raw=bytes.toString("latin1");
  const active=/(?:\/OpenAction\b|\/AA\b|\/JavaScript\b|\/JS\b|\/Launch\b|\/EmbeddedFiles\b)/i;
  const normalizeNames=(value:string)=>{let current=value;for(let i=0;i<4;i++){const decoded=current.replace(/#([0-9a-f]{2})/gi,(_,hex)=>String.fromCharCode(Number.parseInt(hex,16)));if(decoded===current)break;current=decoded;}return current;};
  if(active.test(normalizeNames(raw)))throw new AttachmentError("PDF 包含主动内容，禁止上传");
  try{const document=await PDFDocument.load(bytes,{ignoreEncryption:false,throwOnInvalidObject:true,updateMetadata:false});const objects=[...document.context.enumerateIndirectObjects()].map(([,object])=>normalizeNames(object.toString())).join("\n");if(active.test(objects))throw new AttachmentError("PDF 包含主动内容，禁止上传");const eof=raw.lastIndexOf("%%EOF");if(eof<0||raw.slice(eof+5).trim())throw new AttachmentError("PDF 结尾存在多余内容");}catch(error){if(error instanceof AttachmentError)throw error;throw new AttachmentError("PDF 结构损坏或无法完整解析");}
}

export async function validateAttachmentUpload(input:UploadInput) {
  const extension=extname(input.name).toLowerCase(); const rule=allowed.get(extension);
  if(!rule) throw new AttachmentError("仅支持 PDF、PNG、JPG 文件");
  if(input.bytes.length===0||input.bytes.length>MAX_ATTACHMENT_BYTES) throw new AttachmentError("单个附件不得超过 20 MB");
  if(input.mime!==rule.mime||!rule.magic(input.bytes)) throw new AttachmentError("文件类型与内容不一致");
  const description=input.description.trim();
  if(description.length>MAX_ATTACHMENT_DESCRIPTION) throw new AttachmentError("附件说明不得超过 500 个字符");
  if(!input.rightsConfirmed) throw new AttachmentError("必须确认拥有附件版权或公开权限");
  if(extension===".pdf")await parsePdf(input.bytes);else await parseImage(input.bytes,extension);
  return { mimeType:rule.mime, extension, description };
}

export function createAttachmentObjectKey(recordId:string, extension:string) {
  const safeRecord=recordId.replace(/[^a-zA-Z0-9_-]/g,"_");
  return `records/${safeRecord}/${randomUUID()}${extension}`;
}

export function safeContentDisposition(filename:string) {
  const fallback=filename.replace(/[^\x20-\x7e]/g,"_").replace(/["\\\r\n]/g,"_")||"attachment";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()]/g,escape)}`;
}
