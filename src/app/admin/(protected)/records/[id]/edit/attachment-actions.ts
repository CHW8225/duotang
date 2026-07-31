"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { consumeAuthRateLimit } from "@/lib/auth-runtime";
import { createAttachmentObjectKey, validateAttachmentUpload } from "@/lib/attachments";
import { persistUploadedAttachment, updateAttachment } from "@/lib/attachment-repository";
import { createTencentCosStore } from "@/lib/cos-store";

export type AttachmentActionState={status:"idle"|"error"|"success";message?:string};
export async function uploadAttachmentAction(recordId:string,_:AttachmentActionState,formData:FormData):Promise<AttachmentActionState>{
  try{const admin=await requireAdmin();if(!await consumeAuthRateLimit("admin-attachment-upload",admin.username,20))return{status:"error",message:"上传过于频繁，请稍后重试"};const file=formData.get("file");if(!(file instanceof File))return{status:"error",message:"请选择附件"};const bytes=Buffer.from(await file.arrayBuffer());const checked=await validateAttachmentUpload({name:file.name,mime:file.type,bytes,description:String(formData.get("description")??""),rightsConfirmed:formData.get("rightsConfirmed")==="on"});const objectKey=createAttachmentObjectKey(recordId,checked.extension);await persistUploadedAttachment({recordId,objectKey,originalFilename:file.name,mimeType:checked.mimeType,byteSize:bytes.length,description:checked.description,isPublic:formData.get("isPublic")==="on",actor:admin.username},createTencentCosStore(),bytes);revalidatePath(`/admin/records/${recordId}/edit`);revalidatePath(`/records/${recordId}`);return{status:"success",message:"附件上传成功"};}catch(e){return{status:"error",message:e instanceof Error?e.message:"附件上传失败"};}
}
export async function updateAttachmentAction(recordId:string,id:string,formData:FormData){const admin=await requireAdmin();await updateAttachment(id,admin.username,String(formData.get("description")??""),formData.get("isPublic")==="on");revalidatePath(`/admin/records/${recordId}/edit`);revalidatePath(`/records/${recordId}`);}
export async function deleteAttachmentAction(recordId:string,id:string){const admin=await requireAdmin();await updateAttachment(id,admin.username,"",false,true);revalidatePath(`/admin/records/${recordId}/edit`);revalidatePath(`/records/${recordId}`);}
