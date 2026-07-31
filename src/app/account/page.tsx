import Link from "next/link";
import { AuthPage } from "@/components/AuthPage";
import { requireUser } from "@/lib/auth-runtime";
import { getUserLibraryRepository } from "@/lib/user-library";
import { logoutAction } from "../auth-actions";
import { removeFavoriteAction, removeSavedSearchAction } from "../library-actions";

export const dynamic="force-dynamic";
export default async function AccountPage(){
  const user=await requireUser();
  const repository=getUserLibraryRepository();
  const [favorites,searches]=await Promise.all([repository.listFavorites(user.id),repository.listSavedSearches(user.id)]);
  return <AuthPage title="个人中心" description="管理您的收藏记录与常用科研检索。">
    <dl className="account-details"><dt>邮箱</dt><dd>{user.email}</dd><dt>邮箱状态</dt><dd>已验证</dd></dl>
    <section className="account-library"><h2>收藏记录</h2>{favorites.length?<ul>{favorites.map(item=><li key={item.recordId}><div><Link href={`/records/${item.recordId}`}>{item.standardName||item.englishName}</Link><span>{item.sourceSpecies}</span></div><form action={removeFavoriteAction}><input name="recordId" type="hidden" value={item.recordId}/><button className="text-link" type="submit">取消收藏</button></form></li>)}</ul>:<p className="empty-state">尚未收藏记录。</p>}</section>
    <section className="account-library"><h2>已保存检索 <small>{searches.length}/50</small></h2>{searches.length?<ul>{searches.map(item=>{const query=new URLSearchParams(item.query).toString();return <li key={item.id}><Link href={`/database?${query}`}>{item.name}</Link><form action={removeSavedSearchAction}><input name="searchId" type="hidden" value={item.id}/><button className="text-link" type="submit">删除</button></form></li>;})}</ul>:<p className="empty-state">尚未保存检索。</p>}</section>
    <form action={logoutAction}><button type="submit">退出登录</button></form>
  </AuthPage>;
}
