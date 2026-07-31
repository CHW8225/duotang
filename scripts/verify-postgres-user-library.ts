import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { buildPostgresPoolConfig } from "../src/lib/postgres-config";

const code=(error:unknown)=>error instanceof Error&&"code" in error?String(error.code):"";
async function rollback(client:PoolClient){try{await client.query("ROLLBACK");}catch{}}

async function main(){
  const testUrl=process.env.TEST_DATABASE_URL?.trim();
  if(!testUrl){process.stdout.write("SKIP: TEST_DATABASE_URL is not configured; no PostgreSQL checks were run.\n");return;}
  const pool=new Pool(buildPostgresPoolConfig({...process.env,DATABASE_URL:testUrl}));
  const firstConnection=await pool.connect();
  const secondConnection=await pool.connect();
  const userId=randomUUID();const recordId=`library-${randomUUID()}`;
  try{
    await pool.query("INSERT INTO users(id,email,password_hash,status) VALUES($1,$2,'test-only','active')",[userId,`${userId}@example.invalid`]);
    await pool.query("INSERT INTO polysaccharide_records(id,created_at,updated_at) VALUES($1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",[recordId]);
    for(let index=0;index<49;index+=1)await pool.query("INSERT INTO saved_searches(id,user_id,name,query_params) VALUES($1,$2,$3,$4)",[randomUUID(),userId,`seed-${index}`,{page:String(index+1)}]);

    const compete=async(client:PoolClient,name:string)=>{await client.query("BEGIN");try{await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[userId]);const result=await client.query("SELECT COUNT(*)::int count FROM saved_searches WHERE user_id=$1",[userId]);if(Number(result.rows[0].count)>=50){await client.query("ROLLBACK");return "limit";}await client.query("INSERT INTO saved_searches(id,user_id,name,query_params) VALUES($1,$2,$3,$4)",[randomUUID(),userId,name,{keyword:name}]);await client.query("COMMIT");return "inserted";}catch(error){await rollback(client);throw error;}};
    const race=await Promise.all([compete(firstConnection,"race-a"),compete(secondConnection,"race-b")]);
    if(race.filter(x=>x==="inserted").length!==1||race.filter(x=>x==="limit").length!==1)throw new Error("50/51 saved-search race was not serialized");

    await firstConnection.query("BEGIN");
    await firstConnection.query("SELECT id FROM polysaccharide_records WHERE id=$1 AND deleted_at IS NULL FOR SHARE",[recordId]);
    await firstConnection.query("INSERT INTO favorites(id,user_id,record_id) VALUES($1,$2,$3)",[randomUUID(),userId,recordId]);
    await secondConnection.query("BEGIN");await secondConnection.query("SET LOCAL lock_timeout='250ms'");
    try{await secondConnection.query("UPDATE polysaccharide_records SET deleted_at=CURRENT_TIMESTAMP,deleted_by='integration',deletion_reason='race' WHERE id=$1",[recordId]);throw new Error("soft delete unexpectedly bypassed favorite lock");}catch(error){if(code(error)!=="55P03")throw error;await secondConnection.query("ROLLBACK");}
    await firstConnection.query("ROLLBACK");
    const rolledBack=await pool.query("SELECT COUNT(*)::int count FROM favorites WHERE user_id=$1 AND record_id=$2",[userId,recordId]);if(Number(rolledBack.rows[0].count)!==0)throw new Error("favorite rollback failed");
    await secondConnection.query("BEGIN");await secondConnection.query("UPDATE polysaccharide_records SET deleted_at=CURRENT_TIMESTAMP,deleted_by='integration',deletion_reason='race' WHERE id=$1",[recordId]);await secondConnection.query("COMMIT");
    const active=await pool.query("SELECT id FROM polysaccharide_records WHERE id=$1 AND deleted_at IS NULL",[recordId]);if(active.rowCount!==0)throw new Error("soft-deleted record remained active");
    process.stdout.write("PostgreSQL user-library 50/51 race, lock rollback, and soft-delete race checks passed.\n");
  }finally{await rollback(firstConnection);await rollback(secondConnection);await pool.query("DELETE FROM users WHERE id=$1",[userId]);await pool.query("DELETE FROM polysaccharide_records WHERE id=$1",[recordId]);firstConnection.release();secondConnection.release();await pool.end();}
}
main().catch(error=>{process.stderr.write("PostgreSQL user-library integration failed.\n");if(process.env.NODE_ENV!=="production")process.stderr.write(`${error instanceof Error?error.message:String(error)}\n`);process.exitCode=1;});
