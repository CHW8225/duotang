import Link from "next/link";

export function AuthPage({title,description,children,footer}:{title:string;description:string;children:React.ReactNode;footer?:React.ReactNode}){
  return <main className="auth-page"><section className="auth-panel"><Link href="/" className="auth-back">返回数据库</Link><h1>{title}</h1><p>{description}</p>{children}{footer&&<div className="auth-footer">{footer}</div>}</section></main>;
}
export function AuthMessage({error,notice}:{error?:string;notice?:string}){return <>{error&&<p className="auth-message auth-message--error" role="alert">{error}</p>}{notice&&<p className="auth-message" role="status">{notice}</p>}</>}
