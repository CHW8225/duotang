import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({requireUser:vi.fn(),addFavorite:vi.fn(),removeFavorite:vi.fn(),saveSearch:vi.fn(),removeSavedSearch:vi.fn(),revalidatePath:vi.fn()}));
vi.mock("@/lib/auth-runtime",()=>({requireUser:mocks.requireUser}));
vi.mock("@/lib/user-library",()=>({
  getUserLibraryRepository:()=>mocks,
  parseSavedSearchQuery:(value:string)=>{if(!value)throw new Error("当前没有可保存的检索条件");return {keyword:new URLSearchParams(value).get("keyword")};},
}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidatePath}));

import { addFavoriteAction, removeFavoriteAction, removeSavedSearchAction, saveSearchAction } from "./library-actions";
const idle={status:"idle" as const,message:""};

describe("用户收藏与保存检索 actions",()=>{
  it("use server 模块不导出非函数运行时值",async()=>{const source=await readFile(new URL("./library-actions.ts",import.meta.url),"utf8");expect(source).not.toMatch(/export const initialLibraryActionState/);});
  beforeEach(()=>{vi.clearAllMocks();mocks.requireUser.mockResolvedValue({id:"user-a"});});
  it("每次收藏都重新验证普通用户并刷新页面",async()=>{const data=new FormData();data.set("recordId","poly-0001");await addFavoriteAction(idle,data);expect(mocks.requireUser).toHaveBeenCalledOnce();expect(mocks.addFavorite).toHaveBeenCalledWith("user-a","poly-0001");expect(mocks.revalidatePath).toHaveBeenCalledWith("/account");});
  it("删除操作始终携带当前用户标识",async()=>{const favorite=new FormData();favorite.set("recordId","poly-0001");const search=new FormData();search.set("searchId","other-user-search");await removeFavoriteAction(favorite);await removeSavedSearchAction(search);expect(mocks.removeFavorite).toHaveBeenCalledWith("user-a","poly-0001");expect(mocks.removeSavedSearch).toHaveBeenCalledWith("user-a","other-user-search");});
  it("保存检索使用白名单解析后的查询",async()=>{const data=new FormData();data.set("name","灵芝研究");data.set("query","keyword=灵芝&evil=1");await saveSearchAction(idle,data);expect(mocks.saveSearch).toHaveBeenCalledWith("user-a","灵芝研究",{keyword:"灵芝"});expect(mocks.revalidatePath).toHaveBeenCalledWith("/account");});
  it.each([
    ["检索名称已存在","该检索名称已存在，请更换名称。"],
    ["每位用户最多保存 50 条检索","最多可保存 50 条检索，请先删除不再使用的检索。"],
    ["当前没有可保存的检索条件","当前没有可保存的检索条件。"],
  ])("把可预期保存错误转换为中文状态",async(repositoryMessage,expected)=>{const data=new FormData();data.set("name","测试");data.set("query",repositoryMessage.includes("条件")?"":"keyword=灵芝");if(!repositoryMessage.includes("条件"))mocks.saveSearch.mockRejectedValueOnce(new Error(repositoryMessage));await expect(saveSearchAction(idle,data)).resolves.toEqual({status:"error",message:expected});});
  it("把软删除收藏和未知异常分别映射为安全文案",async()=>{const data=new FormData();data.set("recordId","deleted");mocks.addFavorite.mockRejectedValueOnce(new Error("记录不存在或已删除"));await expect(addFavoriteAction(idle,data)).resolves.toEqual({status:"error",message:"该记录不存在或已被删除，无法收藏。"});mocks.addFavorite.mockRejectedValueOnce(new Error("password=secret internal detail"));const result=await addFavoriteAction(idle,data);expect(result).toEqual({status:"error",message:"操作失败，请稍后重试。"});expect(result.message).not.toContain("secret");});
});
