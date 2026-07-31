import { randomUUID } from "node:crypto";

import { resolveDatabaseBackend } from "./db";
import { getPostgresPool, withPostgresTransaction } from "./postgres";
import { getDatabase } from "./sqlite";

export const SAVED_SEARCH_LIMIT = 50;
export const SAVED_SEARCH_NAME_MAX = 60;

const allowedKeys = new Set([
  "keyword", "species", "sourceCategory", "activity", "evidence",
  "structureCompleteness", "hasDoi", "reviewStatus", "yearFrom", "yearTo",
  "sort", "page", "pageSize",
]);

export class LibraryError extends Error {}

export type SavedSearchQuery = Record<string, string>;
export type FavoriteItem = { recordId: string; standardName: string; englishName: string; sourceSpecies: string; createdAt: string };
export type SavedSearchItem = { id: string; name: string; query: SavedSearchQuery; createdAt: string };

export function parseSavedSearchQuery(input: string | URLSearchParams): SavedSearchQuery {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const result: SavedSearchQuery = {};
  for (const [key, value] of params) {
    const clean = value.trim();
    if (allowedKeys.has(key) && clean && clean.length <= 200) result[key] = clean;
  }
  if (Object.keys(result).length === 0) throw new LibraryError("当前没有可保存的检索条件");
  return result;
}

function validateName(name: string) {
  const value = name.trim();
  if (!value || value.length > SAVED_SEARCH_NAME_MAX) throw new LibraryError("检索名称须为 1 至 60 个字符");
  return value;
}

export interface UserLibraryRepository {
  addFavorite(userId: string, recordId: string): Promise<void>;
  removeFavorite(userId: string, recordId: string): Promise<void>;
  isFavorite(userId: string, recordId: string): Promise<boolean>;
  listFavorites(userId: string): Promise<FavoriteItem[]>;
  saveSearch(userId: string, name: string, query: SavedSearchQuery): Promise<void>;
  removeSavedSearch(userId: string, id: string): Promise<void>;
  listSavedSearches(userId: string): Promise<SavedSearchItem[]>;
}

export function createSqliteUserLibraryRepository(): UserLibraryRepository {
  const db = () => getDatabase();
  return {
    async addFavorite(userId, recordId) {
      const database=db();
      const transaction=database.transaction(()=>{
        const record=database.prepare("SELECT id FROM polysaccharide_records WHERE id=? AND deleted_at IS NULL").get(recordId);
        if(!record)throw new LibraryError("记录不存在或已删除");
        database.prepare("INSERT OR IGNORE INTO favorites VALUES(?,?,?,?)").run(randomUUID(),userId,recordId,new Date().toISOString());
      });
      transaction.immediate();
    },
    async removeFavorite(userId, recordId) { db().prepare("DELETE FROM favorites WHERE user_id=? AND record_id=?").run(userId, recordId); },
    async isFavorite(userId, recordId) { return Boolean(db().prepare("SELECT 1 FROM favorites f JOIN polysaccharide_records r ON r.id=f.record_id AND r.deleted_at IS NULL WHERE f.user_id=? AND f.record_id=?").get(userId, recordId)); },
    async listFavorites(userId) { return (db().prepare("SELECT f.record_id,r.standard_name,r.english_name,r.source_species,f.created_at FROM favorites f JOIN polysaccharide_records r ON r.id=f.record_id WHERE f.user_id=? AND r.deleted_at IS NULL ORDER BY f.created_at DESC").all(userId) as Record<string,string>[]).map(row => ({ recordId: row.record_id, standardName: row.standard_name, englishName: row.english_name, sourceSpecies: row.source_species, createdAt: row.created_at })); },
    async saveSearch(userId, name, query) {
      const clean = validateName(name);
      try { const database=db();const transaction=database.transaction(()=>{const count=(database.prepare("SELECT COUNT(*) count FROM saved_searches WHERE user_id=?").get(userId) as {count:number}).count;if(count>=SAVED_SEARCH_LIMIT)throw new LibraryError("每位用户最多保存 50 条检索");const now=new Date().toISOString();database.prepare("INSERT INTO saved_searches VALUES(?,?,?,?,?,?)").run(randomUUID(),userId,clean,JSON.stringify(query),now,now);});transaction.immediate(); }
      catch (error) { if (String(error).includes("UNIQUE")) throw new LibraryError("检索名称已存在"); throw error; }
    },
    async removeSavedSearch(userId, id) { db().prepare("DELETE FROM saved_searches WHERE id=? AND user_id=?").run(id,userId); },
    async listSavedSearches(userId) { return (db().prepare("SELECT * FROM saved_searches WHERE user_id=? ORDER BY updated_at DESC").all(userId) as Record<string,string>[]).map(row=>({id:row.id,name:row.name,query:JSON.parse(row.query_params) as SavedSearchQuery,createdAt:row.created_at})); },
  };
}

export function createPostgresUserLibraryRepository(): UserLibraryRepository {
  const pool=()=>getPostgresPool();
  return {
    async addFavorite(userId,recordId){await withPostgresTransaction(async client=>{const record=await client.query("SELECT id FROM polysaccharide_records WHERE id=$1 AND deleted_at IS NULL FOR SHARE",[recordId]);if(!record.rowCount)throw new LibraryError("记录不存在或已删除");await client.query("INSERT INTO favorites(id,user_id,record_id) VALUES($1,$2,$3) ON CONFLICT(user_id,record_id) DO NOTHING",[randomUUID(),userId,recordId]);});},
    async removeFavorite(userId,recordId){await pool().query("DELETE FROM favorites WHERE user_id=$1 AND record_id=$2",[userId,recordId]);},
    async isFavorite(userId,recordId){const r=await pool().query("SELECT 1 FROM favorites f JOIN polysaccharide_records r ON r.id=f.record_id AND r.deleted_at IS NULL WHERE f.user_id=$1 AND f.record_id=$2",[userId,recordId]);return Boolean(r.rowCount);},
    async listFavorites(userId){const r=await pool().query("SELECT f.record_id,r.standard_name,r.english_name,r.source_species,f.created_at FROM favorites f JOIN polysaccharide_records r ON r.id=f.record_id WHERE f.user_id=$1 AND r.deleted_at IS NULL ORDER BY f.created_at DESC",[userId]);return r.rows.map(x=>({recordId:String(x.record_id),standardName:String(x.standard_name),englishName:String(x.english_name),sourceSpecies:String(x.source_species),createdAt:new Date(x.created_at).toISOString()}));},
    async saveSearch(userId,name,query){const clean=validateName(name);try{await withPostgresTransaction(async client=>{await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[userId]);const count=await client.query("SELECT COUNT(*) count FROM saved_searches WHERE user_id=$1",[userId]);if(Number(count.rows[0].count)>=SAVED_SEARCH_LIMIT)throw new LibraryError("每位用户最多保存 50 条检索");await client.query("INSERT INTO saved_searches(id,user_id,name,query_params) VALUES($1,$2,$3,$4)",[randomUUID(),userId,clean,query]);});}catch(error){if((error as {code?:string}).code==="23505")throw new LibraryError("检索名称已存在");throw error;}},
    async removeSavedSearch(userId,id){await pool().query("DELETE FROM saved_searches WHERE id=$1 AND user_id=$2",[id,userId]);},
    async listSavedSearches(userId){const r=await pool().query("SELECT * FROM saved_searches WHERE user_id=$1 ORDER BY updated_at DESC",[userId]);return r.rows.map(x=>({id:String(x.id),name:String(x.name),query:x.query_params as SavedSearchQuery,createdAt:new Date(x.created_at).toISOString()}));},
  };
}

export function getUserLibraryRepository(){return resolveDatabaseBackend()==="postgres"?createPostgresUserLibraryRepository():createSqliteUserLibraryRepository();}
