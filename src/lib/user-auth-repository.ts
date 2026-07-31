import { resolveDatabaseBackend } from "./db";
import { getPostgresPool, withPostgresTransaction } from "./postgres";
import { getDatabase } from "./sqlite";
import type { AuthEmailToken, AuthUser, UserAuthRepository, UserSession, UserStatus } from "./user-auth";

function mapUser(row: Record<string, unknown>): AuthUser {
  return { id: String(row.id), email: String(row.email), passwordHash: String(row.password_hash),
    status: String(row.status) as UserStatus,
    emailVerifiedAt: row.email_verified_at ? new Date(String(row.email_verified_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString() };
}

export function createSqliteUserAuthRepository(): UserAuthRepository {
  const db = () => getDatabase();
  return {
    async createUser(u) { db().prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)").run(u.id,u.email,u.passwordHash,u.emailVerifiedAt,u.status,u.createdAt,u.updatedAt); },
    async findUserByEmail(email) { const row=db().prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as Record<string,unknown>|undefined; return row?mapUser(row):null; },
    async findUserById(id) { const row=db().prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string,unknown>|undefined; return row?mapUser(row):null; },
    async updateUserStatus(id,status,verifiedAt) { db().prepare("UPDATE users SET status=?, email_verified_at=COALESCE(?,email_verified_at), updated_at=? WHERE id=?").run(status,verifiedAt,verifiedAt??new Date().toISOString(),id); },
    async updatePassword(id,hash,at) { db().prepare("UPDATE users SET password_hash=?, updated_at=? WHERE id=?").run(hash,at,id); },
    async insertEmailToken(t) { db().prepare("INSERT INTO email_tokens VALUES (?, ?, ?, ?, ?, ?, ?)").run(t.id,t.userId,t.tokenHash,t.purpose,t.expiresAt,t.usedAt,t.createdAt); },
    async consumeEmailToken(hash,purpose,now) { const transaction=db().transaction(()=>{ const row=db().prepare("SELECT * FROM email_tokens WHERE token_hash=? AND purpose=? AND used_at IS NULL AND expires_at>?").get(hash,purpose,now) as Record<string,unknown>|undefined; if(!row)return null; db().prepare("UPDATE email_tokens SET used_at=? WHERE id=?").run(now,row.id); return {id:String(row.id),userId:String(row.user_id),tokenHash:String(row.token_hash),purpose:String(row.purpose),expiresAt:String(row.expires_at),usedAt:now,createdAt:String(row.created_at)} as AuthEmailToken; }); return transaction.immediate(); },
    async activateUserWithToken(hash,now) { const transaction=db().transaction(()=>{const row=db().prepare("SELECT id,user_id FROM email_tokens WHERE token_hash=? AND purpose='verify_email' AND used_at IS NULL AND expires_at>?").get(hash,now) as {id:string;user_id:string}|undefined;if(!row)return false;db().prepare("UPDATE email_tokens SET used_at=? WHERE id=?").run(now,row.id);const result=db().prepare("UPDATE users SET status='active',email_verified_at=?,updated_at=? WHERE id=? AND status='pending'").run(now,now,row.user_id);if(result.changes!==1)throw new Error("Verification user is not pending");return true;});return transaction.immediate(); },
    async resetPasswordWithToken(hash,passwordHash,now) { const transaction=db().transaction(()=>{const row=db().prepare("SELECT id,user_id FROM email_tokens WHERE token_hash=? AND purpose='reset_password' AND used_at IS NULL AND expires_at>?").get(hash,now) as {id:string;user_id:string}|undefined;if(!row)return false;db().prepare("UPDATE email_tokens SET used_at=? WHERE id=?").run(now,row.id);const result=db().prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=? AND status='active'").run(passwordHash,now,row.user_id);if(result.changes!==1)throw new Error("Reset user is not active");db().prepare("DELETE FROM user_sessions WHERE user_id=?").run(row.user_id);return true;});return transaction.immediate(); },
    async insertSession(s) { db().prepare("INSERT INTO user_sessions VALUES (?, ?, ?, ?)").run(s.tokenHash,s.userId,s.createdAt,s.expiresAt); },
    async findSession(hash,now) { const row=db().prepare("SELECT s.*,u.* FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").get(hash,now) as Record<string,unknown>|undefined; if(!row)return null; return {tokenHash:hash,userId:String(row.user_id),createdAt:String(row.created_at),expiresAt:String(row.expires_at),user:mapUser(row)}; },
    async deleteSession(hash) { db().prepare("DELETE FROM user_sessions WHERE token_hash=?").run(hash); },
    async deleteUserSessions(id) { db().prepare("DELETE FROM user_sessions WHERE user_id=?").run(id); },
  };
}

export function createPostgresUserAuthRepository(): UserAuthRepository {
  const pool=()=>getPostgresPool();
  return {
    async createUser(u){await pool().query("INSERT INTO users(id,email,password_hash,email_verified_at,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)",[u.id,u.email,u.passwordHash,u.emailVerifiedAt,u.status,u.createdAt,u.updatedAt]);},
    async findUserByEmail(email){const r=await pool().query("SELECT * FROM users WHERE LOWER(email)=LOWER($1)",[email]);return r.rows[0]?mapUser(r.rows[0]):null;},
    async findUserById(id){const r=await pool().query("SELECT * FROM users WHERE id=$1",[id]);return r.rows[0]?mapUser(r.rows[0]):null;},
    async updateUserStatus(id,status,verifiedAt){await pool().query("UPDATE users SET status=$1,email_verified_at=COALESCE($2,email_verified_at),updated_at=COALESCE($2,CURRENT_TIMESTAMP) WHERE id=$3",[status,verifiedAt,id]);},
    async updatePassword(id,hash,at){await pool().query("UPDATE users SET password_hash=$1,updated_at=$2 WHERE id=$3",[hash,at,id]);},
    async insertEmailToken(t){await pool().query("INSERT INTO email_tokens(id,user_id,token_hash,purpose,expires_at,used_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",[t.id,t.userId,t.tokenHash,t.purpose,t.expiresAt,t.usedAt,t.createdAt]);},
    async consumeEmailToken(hash,purpose,now){return withPostgresTransaction(async c=>{const r=await c.query("UPDATE email_tokens SET used_at=$3 WHERE token_hash=$1 AND purpose=$2 AND used_at IS NULL AND expires_at>$3 RETURNING *",[hash,purpose,now]);const x=r.rows[0];return x?{id:String(x.id),userId:String(x.user_id),tokenHash:String(x.token_hash),purpose:x.purpose,expiresAt:new Date(x.expires_at).toISOString(),usedAt:new Date(x.used_at).toISOString(),createdAt:new Date(x.created_at).toISOString()}:null;});},
    async activateUserWithToken(hash,now){return withPostgresTransaction(async c=>{const token=await c.query("UPDATE email_tokens SET used_at=$2 WHERE token_hash=$1 AND purpose='verify_email' AND used_at IS NULL AND expires_at>$2 RETURNING user_id",[hash,now]);if(!token.rows[0])return false;const user=await c.query("UPDATE users SET status='active',email_verified_at=$1,updated_at=$1 WHERE id=$2 AND status='pending'",[now,token.rows[0].user_id]);if(user.rowCount!==1)throw new Error("Verification user is not pending");return true;});},
    async resetPasswordWithToken(hash,passwordHash,now){return withPostgresTransaction(async c=>{const token=await c.query("UPDATE email_tokens SET used_at=$2 WHERE token_hash=$1 AND purpose='reset_password' AND used_at IS NULL AND expires_at>$2 RETURNING user_id",[hash,now]);if(!token.rows[0])return false;const user=await c.query("UPDATE users SET password_hash=$1,updated_at=$2 WHERE id=$3 AND status='active'",[passwordHash,now,token.rows[0].user_id]);if(user.rowCount!==1)throw new Error("Reset user is not active");await c.query("DELETE FROM user_sessions WHERE user_id=$1",[token.rows[0].user_id]);return true;});},
    async insertSession(s){await pool().query("INSERT INTO user_sessions(token_hash,user_id,created_at,expires_at) VALUES($1,$2,$3,$4)",[s.tokenHash,s.userId,s.createdAt,s.expiresAt]);},
    async findSession(hash,now){const r=await pool().query("SELECT s.token_hash,s.user_id,s.created_at AS session_created_at,s.expires_at,u.* FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2",[hash,now]);const x=r.rows[0];return x?{tokenHash:String(x.token_hash),userId:String(x.user_id),createdAt:new Date(x.session_created_at).toISOString(),expiresAt:new Date(x.expires_at).toISOString(),user:mapUser(x)}:null;},
    async deleteSession(hash){await pool().query("DELETE FROM user_sessions WHERE token_hash=$1",[hash]);},
    async deleteUserSessions(id){await pool().query("DELETE FROM user_sessions WHERE user_id=$1",[id]);},
  };
}

export function getUserAuthRepository(){return resolveDatabaseBackend()==="postgres"?createPostgresUserAuthRepository():createSqliteUserAuthRepository();}
