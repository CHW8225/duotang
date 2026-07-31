import Link from "next/link";

const links = [
  ["数据检索", "/database"],
  ["数据质量", "/quality"],
];

export function SiteHeader() {
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
      </div>
    </header>
  );
}
