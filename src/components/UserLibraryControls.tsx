"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addFavoriteAction, removeFavoriteWithStateAction, saveSearchAction, type LibraryActionState } from "../app/library-actions";

const initialLibraryActionState:LibraryActionState={status:"idle",message:""};

type Props={loggedIn:boolean;mode:"favorite"|"search";recordId?:string;favorite?:boolean;query?:string;initialState?:LibraryActionState};
export function UserLibraryControls(props:Props){
  const action=props.mode==="search"?saveSearchAction:(props.favorite?removeFavoriteWithStateAction:addFavoriteAction);
  const [state,formAction,pending]=useActionState(action,props.initialState??initialLibraryActionState);
  if(!props.loggedIn)return <div className="library-controls"><Link className="button button--quiet" href="/login">{props.mode==="favorite"?"登录后收藏":"登录后保存检索"}</Link></div>;
  return <div>{props.mode==="favorite"?
    <form action={formAction} className="library-controls"><input name="recordId" type="hidden" value={props.recordId}/><button className="button button--quiet" disabled={pending} type="submit">{props.favorite?"取消收藏":"收藏记录"}</button></form>:
    <form action={formAction} className="library-controls library-controls--search"><label>检索名称<input maxLength={60} name="name" placeholder="例如：灵芝免疫活性" required/></label><input name="query" type="hidden" value={props.query}/><button className="button button--quiet" disabled={pending} type="submit">保存当前检索</button></form>}
    {state.message?<p className={`library-message library-message--${state.status}`} role={state.status==="error"?"alert":"status"}>{state.message}</p>:null}
  </div>;
}
