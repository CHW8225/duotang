import COS from "cos-nodejs-sdk-v5";
import { PassThrough, type Readable } from "node:stream";

export type AttachmentStore = {
  put(objectKey:string, bytes:Buffer, mimeType:string):Promise<void>;
  remove(objectKey:string):Promise<void>;
  get(objectKey:string):Promise<Buffer>;
  open(objectKey:string, limits:{maxBytes:number;timeoutMs:number}):Promise<{stream:Readable;size:number}>;
  signedUrl(objectKey:string, disposition:string):Promise<string>;
};

function config() {
  const SecretId=process.env.TENCENT_COS_SECRET_ID?.trim();
  const SecretKey=process.env.TENCENT_COS_SECRET_KEY?.trim();
  const Bucket=process.env.TENCENT_COS_BUCKET?.trim();
  const Region=process.env.TENCENT_COS_REGION?.trim();
  if(!SecretId||!SecretKey||!Bucket||!Region) throw new Error("腾讯云 COS 环境变量未完整配置");
  return { SecretId,SecretKey,Bucket,Region };
}

export function createTencentCosStore():AttachmentStore {
  const c=config(); const client=new COS({SecretId:c.SecretId,SecretKey:c.SecretKey});
  return {
    put:(Key,Body,ContentType)=>new Promise((resolve,reject)=>client.putObject({Bucket:c.Bucket,Region:c.Region,Key,Body,ContentType},e=>e?reject(e):resolve())),
    remove:(Key)=>new Promise((resolve,reject)=>client.deleteObject({Bucket:c.Bucket,Region:c.Region,Key},e=>e?reject(e):resolve())),
    get:(Key)=>new Promise((resolve,reject)=>client.getObject({Bucket:c.Bucket,Region:c.Region,Key},(e,d)=>e?reject(e):resolve(Buffer.isBuffer(d.Body)?d.Body:Buffer.from(d.Body as unknown as Uint8Array)))),
    open:async(Key,limits)=>{const head=await new Promise<COS.HeadObjectResult>((resolve,reject)=>client.headObject({Bucket:c.Bucket,Region:c.Region,Key},(e,d)=>e?reject(e):resolve(d)));const size=Number(head.headers?.["content-length"]??0);if(!Number.isFinite(size)||size<1||size>limits.maxBytes)throw new Error("COS 对象大小超过附件限制");const output=new PassThrough();client.getObject({Bucket:c.Bucket,Region:c.Region,Key,Output:output},error=>{if(error)output.destroy(new Error(error.message));});const timer=setTimeout(()=>output.destroy(new Error("COS 读取超时")),limits.timeoutMs);output.once("end",()=>clearTimeout(timer));output.once("error",()=>clearTimeout(timer));return{stream:output,size};},
    signedUrl:(Key,disposition)=>new Promise((resolve,reject)=>client.getObjectUrl({Bucket:c.Bucket,Region:c.Region,Key,Sign:true,Expires: 300,Query:{"response-content-disposition":disposition}},(e,d)=>e?reject(e):resolve(d.Url))),
  };
}
