import { NextResponse } from "next/server";
import { readAuthorizedAttachment } from "@/lib/attachment-repository";
import { createTencentCosStore } from "@/lib/cos-store";
import { safeContentDisposition } from "@/lib/attachments";
import { consumeAttachmentDownloadRateLimit } from "@/lib/attachment-download-rate-limit";
import { Readable } from "node:stream";
export const runtime="nodejs";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;if(!await consumeAttachmentDownloadRateLimit(id))return new NextResponse("下载请求过于频繁",{status:429});const result=await readAuthorizedAttachment(id,createTencentCosStore());if(!result)return new NextResponse("附件不存在或不可公开访问",{status:404});return new NextResponse(Readable.toWeb(result.stream) as ReadableStream,{headers:{"Content-Type":result.attachment.mimeType,"Content-Length":String(result.size),"Content-Disposition":safeContentDisposition(result.attachment.originalFilename),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosn"}});}
