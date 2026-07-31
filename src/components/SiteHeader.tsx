import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-runtime";

const links = [
  ["数据检索", "/database"],
  ["数据质量", "/quality"],
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/">
          <span className="site-brand__mark">多糖</span>
          <span>多糖科研数据库</span>
        </Link>
        <nav aria-label="主导航" className="site-nav">
          {links.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="site-account"><Link href={user ? "/account" : "/login"}>{user ? "个人中心" : "登录"}</Link></div>
      </div>
    </header>
  );
}
