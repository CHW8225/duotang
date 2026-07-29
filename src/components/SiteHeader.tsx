import Link from "next/link";

const links = [
  ["Database", "/database"],
  ["Data dictionary", "/dictionary"],
  ["Quality", "/quality"],
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-brand" href="/">
          <span className="site-brand__mark">PRD</span>
          <span>Polysaccharide Research Database</span>
        </Link>
        <nav aria-label="Primary navigation" className="site-nav">
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
