import Link from "next/link";
import { ImportConfirmForm, ImportUploadForm } from "@/components/AdminImportForms";
import { getImportJob, listImportJobs } from "@/lib/admin-import-repository";

export default async function AdminImportPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job: jobId } = await searchParams;
  const [job, history] = await Promise.all([jobId ? getImportJob(jobId) : null, listImportJobs()]);
  return <section><header className="admin-page-header"><div><p className="eyebrow">数据管理</p><h1>Excel 批量导入</h1><p>仅接受严格的 42 字段模板。上传只生成预览，不会立即写入正式数据库。</p></div></header><ImportUploadForm/>{job && <section><h2>导入预览</h2><p>总数 {job.totalRows} · 有效 {job.validRows} · 错误 {job.errorRows} · 冲突 {job.conflictRows} · 警告 {job.warningRows}</p><p>状态：{job.status}</p>{job.status === "ready" && <ImportConfirmForm jobId={job.id}/>}<div className="table-scroll"><table><thead><tr><th>行号</th><th>上传编号</th><th>标准名称</th><th>错误</th><th>冲突</th><th>警告</th></tr></thead><tbody>{job.rows.map((row) => <tr key={row.id}><td>{row.rowNumber}</td><td>{row.rowData.upload_id || "未填写"}</td><td>{row.rowData.standard_name || "未填写"}</td><td>{row.errors.join("；") || "无"}</td><td>{row.conflicts.join("；") || "无"}</td><td>{row.warnings.join("；") || "无"}</td></tr>)}</tbody></table></div></section>}<section><h2>最近导入任务</h2>{history.filter(Boolean).length ? <ul>{history.filter(Boolean).map((item) => item && <li key={item.id}><Link href={`/admin/import?job=${item.id}`}>{item.filename}</Link> · {item.status} · {item.totalRows} 条 · {new Date(item.createdAt).toLocaleString("zh-CN")}</li>)}</ul> : <p>暂无导入任务</p>}</section></section>;
}
