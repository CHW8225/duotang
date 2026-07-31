import { randomUUID } from "node:crypto";
import COS from "cos-nodejs-sdk-v5";
import { Pool } from "pg";
import sharp from "sharp";

async function main(){
const required=["TEST_DATABASE_URL","TEST_COS_SECRET_ID","TEST_COS_SECRET_KEY","TEST_COS_BUCKET","TEST_COS_REGION"] as const;
const missing=required.filter(key=>!process.env[key]?.trim());
if(missing.length){console.log(`SKIP cloud attachment integration: missing ${missing.join(", ")}`);process.exit(0);}

process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
process.env.TENCENT_COS_SECRET_ID=process.env.TEST_COS_SECRET_ID;
process.env.TENCENT_COS_SECRET_KEY=process.env.TEST_COS_SECRET_KEY;
process.env.TENCENT_COS_BUCKET=process.env.TEST_COS_BUCKET;
process.env.TENCENT_COS_REGION=process.env.TEST_COS_REGION;

const [{createTencentCosStore},{persistUploadedAttachment,readAuthorizedAttachment,updateAttachment},{processCosCleanupJobs},{softDeleteRecord,restoreRecord}]=await Promise.all([import("../src/lib/cos-store"),import("../src/lib/attachment-repository"),import("../src/lib/cos-cleanup"),import("../src/lib/db")]);
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL});
const cos=new COS({SecretId:process.env.TEST_COS_SECRET_ID!,SecretKey:process.env.TEST_COS_SECRET_KEY!});
const Bucket=process.env.TEST_COS_BUCKET!,Region=process.env.TEST_COS_REGION!;
const acl=await new Promise<COS.GetBucketAclResult>((resolve,reject)=>cos.getBucketAcl({Bucket,Region},(e,d)=>e?reject(e):resolve(d)));
if((acl.Grants??[]).some(grant=>"URI" in grant.Grantee&&grant.Grantee.URI?.includes("AllUsers")))throw new Error("TEST COS bucket must be private");

const record=(await pool.query("SELECT id,standard_name FROM polysaccharide_records WHERE deleted_at IS NULL ORDER BY sort_order DESC LIMIT 1")).rows[0];
if(!record)throw new Error("Test database has no active record");
const prefix=`integration-tests/${randomUUID()}`,store=createTencentCosStore();const ids:string[]=[],keys:string[]=[];
try{
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:"green"}}).png().toBuffer();
  const uploads=Array.from({length:10},async(_,index)=>{const objectKey=`${prefix}/${index}.png`;keys.push(objectKey);const attachment=await persistUploadedAttachment({recordId:String(record.id),objectKey,originalFilename:`test-${index}.png`,mimeType:"image/png",byteSize:bytes.length,description:"integration",isPublic:true,actor:"integration-test"},store,bytes);ids.push(attachment.id);});
  await Promise.all(uploads);
  const eleventhKey=`${prefix}/eleventh.png`;keys.push(eleventhKey);await persistUploadedAttachment({recordId:String(record.id),objectKey:eleventhKey,originalFilename:"eleventh.png",mimeType:"image/png",byteSize:bytes.length,description:"limit",isPublic:true,actor:"integration-test"},store,bytes).then(()=>{throw new Error("Eleventh attachment was accepted")},error=>{if(!String(error).includes("10"))throw error});
  await Promise.all(ids.map(async id=>{const read=await readAuthorizedAttachment(id,store);if(!read)throw new Error("Private COS proxy read denied");const chunks:Buffer[]=[];for await(const chunk of read.stream)chunks.push(Buffer.from(chunk));if(!Buffer.concat(chunks).equals(bytes))throw new Error("Private COS proxy read mismatch");}));
  await updateAttachment(ids[0],"integration-test","soft deleted",false,true);
  if(await readAuthorizedAttachment(ids[0],store))throw new Error("Soft-deleted attachment remained readable");
  await softDeleteRecord(String(record.id),"integration-test","integration parent soft delete",String(record.standard_name));if(await readAuthorizedAttachment(ids[1],store))throw new Error("Parent soft-delete remained readable");await restoreRecord(String(record.id),"integration-test");const restored=await readAuthorizedAttachment(ids[1],store);if(!restored)throw new Error("Parent restore did not restore authorization");restored.stream.destroy();
  const orphan=`${prefix}/orphan.png`;keys.push(orphan);let failCompensation=true;const compensationStore={...store,remove:async(key:string)=>{if(failCompensation){failCompensation=false;throw new Error("forced compensation failure");}return store.remove(key)}};await persistUploadedAttachment({recordId:"missing-record",objectKey:orphan,originalFilename:"orphan.png",mimeType:"image/png",byteSize:bytes.length,description:"compensation",isPublic:false,actor:"integration-test"},compensationStore,bytes).then(()=>{throw new Error("Forced metadata failure did not fail")},()=>undefined);const queued=await pool.query("SELECT status FROM cos_cleanup_jobs WHERE object_key=$1",[orphan]);if(queued.rows[0]?.status!=="pending")throw new Error("Complete compensation failure chain did not enqueue");const cleanup=await processCosCleanupJobs(store);if(cleanup.completed<1)throw new Error("Compensation retry did not complete");
  console.log("PASS cloud attachments: private bucket, concurrent limit, upload/read, soft-delete authorization, compensation retry");
}finally{
  await pool.query("DELETE FROM audit_logs WHERE actor_id='integration-test' OR actor_id='cos-cleanup'");
  await pool.query("DELETE FROM record_attachments WHERE created_by='integration-test'");
  await pool.query("DELETE FROM cos_cleanup_jobs WHERE object_key LIKE $1",[`${prefix}%`]);
  await Promise.all(keys.map(key=>store.remove(key).catch(()=>undefined)));await pool.end();
}
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
