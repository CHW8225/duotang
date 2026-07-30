import { RecordFilters } from "@/components/RecordFilters";
import { getRecords } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DatabasePage() {
  const records = await getRecords();
  return <main className="page-shell"><p className="eyebrow">浏览与筛选</p><h1>数据检索</h1><p className="page-intro">按来源、活性、证据等级、结构完整度、审核状态和发表年份检索标准化多糖记录。</p><RecordFilters records={records} /></main>;
}
