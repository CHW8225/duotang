import Link from "next/link";

export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="page-shell admin-shell"><nav aria-label="Admin navigation" className="admin-nav"><Link href="/admin">Dashboard</Link><Link href="/admin/records">Records</Link><Link href="/admin/records/new">New record</Link></nav>{children}</main>;
}
