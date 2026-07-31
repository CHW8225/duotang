import Link from "next/link";
import { notFound } from "next/navigation";

import { RecordDetailSections } from "@/components/RecordDetailSections";
import { QualityBadge } from "@/components/QualityBadge";
import {
  getBilingualSpeciesName,
  normalizeActivityCategories,
  normalizeEvidenceLevel,
} from "@/lib/terminology";
import { getRecordById } from "@/lib/db";
import {
  getDisplayDoi,
  getMonosaccharideComposition,
  getMonosaccharideRatio,
} from "@/lib/display";

export const dynamic = "force-dynamic";

export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  const returnParam = (await searchParams).returnTo;
  const requestedReturn = Array.isArray(returnParam) ? returnParam[0] : returnParam;
  const returnTo = requestedReturn?.startsWith("/database") ? requestedReturn : "/database";
  const record = await getRecordById(id);
  if (!record) notFound();
  const summary = [
    ["来源物种", getBilingualSpeciesName(record.source_species)],
    ["单糖组成", getMonosaccharideComposition(record)],
    ["组成比例", getMonosaccharideRatio(record)],
    ["分子量", [record.molecular_weight_value, record.molecular_weight_unit].filter(Boolean).join(" ") || "未记录"],
    ["活性", normalizeActivityCategories(record.activity_category).join("、") || "未记录"],
    ["证据等级", normalizeEvidenceLevel(record.evidence_level) || "未记录"],
  ];
  const doi = getDisplayDoi(record);
  return (
    <main className="page-shell">
      <Link className="back-link" href={returnTo}>返回检索结果</Link>
      <p className="eyebrow">记录 {record.upload_id}</p>
      <h1>{record.standard_name || record.english_name || "未命名记录"}</h1>
      <p className="page-intro">{record.english_name}</p>
      <div className="record-statuses">
        <QualityBadge originalValue={record.activity_category} value={normalizeActivityCategories(record.activity_category).join("、")} />
        <QualityBadge originalValue={record.evidence_level} value={normalizeEvidenceLevel(record.evidence_level)} />
        <QualityBadge value={record.review_status} tone="attention" />
      </div>
      <section className="research-summary" aria-label="科研摘要">
        {summary.map(([label, value]) => <div key={label}><span>{label}</span><strong title={value}>{value}</strong></div>)}
        <div>
          <span>DOI</span>
          <strong>{record.doi ? <a href={`https://doi.org/${record.doi}`} rel="noreferrer" target="_blank">{doi}</a> : "未收录"}</strong>
        </div>
      </section>
      <nav className="detail-toc" aria-label="记录页内目录">
        <span>页内目录</span>
        {[
          ["identity", "基本信息"], ["literature", "文献信息"], ["source", "来源与制备"],
          ["structure", "结构信息"], ["bioactivity", "生物活性"], ["management", "数据管理"],
        ].map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
      </nav>
      <p className="normalization-note">
        页面优先显示规范值；当规范值与原始值不同，可悬停查看原始记录。空白项统一显示“未记录”。
      </p>
      <RecordDetailSections record={record} />
    </main>
  );
}
