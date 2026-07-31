import { RestoreRecordButton } from "@/components/RestoreRecordButton";
import { requireAdmin } from "@/lib/auth";
import { getRecordsIncludingDeleted } from "@/lib/db";
import { restoreRecordAction } from "../records/actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminTrashPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const rawKeyword = params.keyword;
  const keyword = (Array.isArray(rawKeyword) ? rawKeyword[0] : rawKeyword ?? "").trim().toLocaleLowerCase("zh-CN");
  const deletedRecords = (await getRecordsIncludingDeleted())
    .filter((record) => record.deleted_at)
    .filter((record) => !keyword || [
      record.standard_name,
      record.english_name,
      record.source_species,
      record.doi,
      record.deletion_reason,
      record.deleted_by,
    ].some((value) => value?.toLocaleLowerCase("zh-CN").includes(keyword)));

  return <>
    <div className="admin-page-heading"><div><p className="eyebrow">记录管理</p><h1>回收站</h1></div></div>
    <p className="section-note">此处仅保留软删除记录。恢复后记录会重新进入前台检索、统计和导出。</p>
    <form className="admin-search" method="get">
      <label className="filter-field filter-field--wide"><span>筛选回收站</span><input defaultValue={keyword} name="keyword" placeholder="名称、物种、DOI、删除原因或操作者" /></label>
      <button className="button button--quiet" type="submit">筛选</button>
    </form>
    {deletedRecords.length === 0 ? <div className="empty-state"><h2>回收站暂无匹配记录</h2><p>调整筛选条件后重试。</p></div> : <div className="table-wrap"><table className="record-table"><thead><tr><th>标准名称</th><th>来源物种</th><th>删除原因</th><th>操作者</th><th>删除时间</th><th><span className="sr-only">恢复记录</span></th></tr></thead><tbody>{deletedRecords.map((record) => <tr key={record.id}><td className="record-table__primary">{record.standard_name || "未记录"}</td><td>{record.source_species || "未记录"}</td><td>{record.deletion_reason}</td><td>{record.deleted_by}</td><td>{record.deleted_at ? new Date(record.deleted_at).toLocaleString("zh-CN") : "-"}</td><td><RestoreRecordButton action={restoreRecordAction.bind(null, record.id)} /></td></tr>)}</tbody></table></div>}
  </>;
}
