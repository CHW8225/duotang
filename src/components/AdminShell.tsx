import Link from "next/link";

export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="page-shell admin-shell"><nav aria-label="后台导航" className="admin-nav"><Link href="/admin">管理概览</Link><Link href="/admin/records">记录管理</Link><Link href="/admin/import">批量导入</Link><Link href="/admin/trash">回收站</Link><Link href="/admin/quality">质量问题</Link><Link href="/admin/records/new">新建记录</Link></nav>{children}</main>;
}
