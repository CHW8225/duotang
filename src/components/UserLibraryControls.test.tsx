import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("../app/library-actions",()=>({addFavoriteAction:vi.fn(),removeFavoriteWithStateAction:vi.fn(),saveSearchAction:vi.fn(),initialLibraryActionState:{status:"idle",message:""}}));
import { UserLibraryControls } from "./UserLibraryControls";

describe("用户资料库入口",()=>{
  it("未登录时显示登录引导",()=>{const html=renderToStaticMarkup(<UserLibraryControls mode="favorite" loggedIn={false} recordId="poly-1"/>);expect(html).toContain("登录后收藏");expect(html).toContain("/login");});
  it("已登录时显示中文收藏状态",()=>{const html=renderToStaticMarkup(<UserLibraryControls mode="favorite" loggedIn recordId="poly-1" favorite/>);expect(html).toContain("取消收藏");});
  it("检索页显示名称输入与保存按钮",()=>{const html=renderToStaticMarkup(<UserLibraryControls mode="search" loggedIn query="keyword=灵芝"/>);expect(html).toContain("检索名称");expect(html).toContain("保存当前检索");});
  it("为结构化错误状态显示中文警示区域",()=>{const html=renderToStaticMarkup(<UserLibraryControls mode="search" loggedIn query="keyword=灵芝" initialState={{status:"error",message:"检索名称已存在"}}/>);expect(html).toContain('role="alert"');expect(html).toContain("检索名称已存在");});
});
