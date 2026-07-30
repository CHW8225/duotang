export default function NotFoundPage() {
  return (
    <main className="page-shell">
      <p className="eyebrow">页面未找到</p>
      <h1>无法找到请求的内容</h1>
      <p className="page-intro">该记录可能不存在，或已被管理员移除。</p>
      <a className="primary-link" href="/database">
        返回多糖数据库
      </a>
    </main>
  );
}
