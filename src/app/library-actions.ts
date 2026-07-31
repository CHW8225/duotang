"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-runtime";
import { getUserLibraryRepository, parseSavedSearchQuery } from "@/lib/user-library";

export type LibraryActionState={status:"idle"|"success"|"error";message:string};
const value=(data:FormData,key:string)=>String(data.get(key)??"").trim();

function refresh(recordId?:string){revalidatePath("/account");revalidatePath("/database");if(recordId)revalidatePath(`/records/${recordId}`);}
function errorState(error:unknown):LibraryActionState{
  const message=error instanceof Error?error.message:"";
  const known:Record<string,string>={
    "检索名称已存在":"该检索名称已存在，请更换名称。",
    "每位用户最多保存 50 条检索":"最多可保存 50 条检索，请先删除不再使用的检索。",
    "当前没有可保存的检索条件":"当前没有可保存的检索条件。",
    "记录不存在或已删除":"该记录不存在或已被删除，无法收藏。",
  };
  return {status:"error",message:known[message]??"操作失败，请稍后重试。"};
}

export async function addFavoriteAction(_state:LibraryActionState,data:FormData):Promise<LibraryActionState>{try{const user=await requireUser();const id=value(data,"recordId");await getUserLibraryRepository().addFavorite(user.id,id);refresh(id);return {status:"success",message:"已收藏该记录。"};}catch(error){return errorState(error);}}
export async function removeFavoriteWithStateAction(_state:LibraryActionState,data:FormData):Promise<LibraryActionState>{try{const user=await requireUser();const id=value(data,"recordId");await getUserLibraryRepository().removeFavorite(user.id,id);refresh(id);return {status:"success",message:"已取消收藏。"};}catch(error){return errorState(error);}}
export async function saveSearchAction(_state:LibraryActionState,data:FormData):Promise<LibraryActionState>{try{const user=await requireUser();await getUserLibraryRepository().saveSearch(user.id,value(data,"name"),parseSavedSearchQuery(value(data,"query")));refresh();return {status:"success",message:"已保存当前检索。"};}catch(error){return errorState(error);}}
export async function removeFavoriteAction(data:FormData){const user=await requireUser();const id=value(data,"recordId");await getUserLibraryRepository().removeFavorite(user.id,id);refresh(id);}
export async function removeSavedSearchAction(data:FormData){const user=await requireUser();await getUserLibraryRepository().removeSavedSearch(user.id,value(data,"searchId"));refresh();}
