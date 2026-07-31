import { RecordFilters } from "@/components/RecordFilters";
import { getRecords } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DatabasePage() {
  const records = await getRecords();
  return <main className="page-shell"><p className="eyebrow">浏览与筛选</p><h1>数据检索</h1><p className="page-intro">通过关键词和活性类别快速检索标准化多糖记录，关键词可匹配名称、物种、活性、DOI 和单糖组成。</p><RecordFilters records={records} /></main>;
}
