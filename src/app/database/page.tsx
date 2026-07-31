import Link from "next/link";

import { RecordFilters, type FilterOptions } from "@/components/RecordFilters";
import { RecordTable } from "@/components/RecordTable";
import { getRecords } from "@/lib/db";
import {
  activityFacetValues,
  parseRecordQuery,
  queryRecords,
  type RecordQueryInput,
} from "@/lib/search";
import {
  getBilingualSpeciesName,
  EVIDENCE_LEVELS,
  normalizeEvidenceLevel,
  normalizeExperimentType,
  normalizeMonosaccharideComposition,
  normalizeSourceCategories,
  SOURCE_CATEGORIES,
  normalizeStructureCompleteness,
} from "@/lib/terminology";

export const dynamic = "force-dynamic";

const unique = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );

const buildOptions = (records: Awaited<ReturnType<typeof getRecords>>): FilterOptions => ({
  activities: activityFacetValues(records),
  species: unique(records.map((record) => getBilingualSpeciesName(record.source_species))),
  sourceCategories: SOURCE_CATEGORIES.filter((category) =>
    records.some((record) => normalizeSourceCategories(record.source_category).includes(category)),
  ),
  evidenceLevels: EVIDENCE_LEVELS.filter((level) =>
    records.some((record) => normalizeEvidenceLevel(record.evidence_level) === level),
  ),
  experimentTypes: unique(records.map((record) => normalizeExperimentType(record.experiment_type))),
  structureCompleteness: unique(
    records.map((record) => normalizeStructureCompleteness(record.structure_completeness)),
  ),
  monosaccharides: unique(
    records
      .flatMap((record) =>
        (record.monosaccharide_standardized || record.monosaccharide_original)
          .split(/[、,，;；:/|+\s]+/),
      )
      .map((value) => normalizeMonosaccharideComposition(value))
      .filter((value) => value.length <= 24),
  ),
  years: [...new Set(records.flatMap((record) => record.publication_year ?? []))].sort(
    (a, b) => a - b,
  ),
});

const activeFilterSummary = (filters: ReturnType<typeof parseRecordQuery>) => {
  const values = [
    filters.keyword && `关键词：${filters.keyword}`,
    filters.activityCategory && `活性：${filters.activityCategory}`,
    filters.species && `物种：${filters.species}`,
    filters.yearFrom && `年份从 ${filters.yearFrom}`,
    filters.yearTo && `年份至 ${filters.yearTo}`,
    filters.sourceCategory && `来源：${filters.sourceCategory}`,
    filters.evidenceLevel && `证据：${filters.evidenceLevel}`,
    filters.experimentType && `实验：${filters.experimentType}`,
    filters.structureCompleteness && `结构：${filters.structureCompleteness}`,
    filters.monosaccharide && `单糖：${filters.monosaccharide}`,
    filters.hasDoi !== undefined && (filters.hasDoi ? "有 DOI" : "无 DOI"),
  ].filter(Boolean);
  return values.length ? values.join("；") : "全部记录";
};

export default async function DatabasePage({
  searchParams,
}: {
  searchParams: Promise<RecordQueryInput>;
}) {
  const rawQuery = await searchParams;
  const filters = parseRecordQuery(rawQuery);
  const allRecords = await getRecords();
  const result = queryRecords(allRecords, filters);
  const query = new URLSearchParams();

  Object.entries(rawQuery).forEach(([key, value]) => {
    const firstValue = Array.isArray(value) ? value[0] : value;
    if (firstValue) query.set(key, firstValue);
  });
  query.set("page", String(result.page));
  query.set("pageSize", String(result.pageSize));
  query.set("sort", filters.sortBy ?? "publication_year");

  return (
    <main className="page-shell page-shell--wide">
      <p className="eyebrow">科研检索工作台</p>
      <h1>多糖数据检索</h1>
      <p className="page-intro">
        支持名称、物种、活性、单糖组成和 DOI 的联合检索。筛选、排序与分页状态会保留在网址中。
      </p>
      <RecordFilters filters={filters} options={buildOptions(allRecords)} />

      <section className="results-toolbar" aria-label="检索结果控制">
        <div>
          <strong>{result.total.toLocaleString("zh-CN")}</strong> 条记录
          <span className="results-toolbar__summary" title={activeFilterSummary(filters)}>
            {activeFilterSummary(filters)}
          </span>
        </div>
        <form action="/database" className="results-toolbar__controls" method="get">
          {[...query.entries()]
            .filter(([key]) => !["page", "pageSize", "sort"].includes(key))
            .map(([key, value]) => <input key={key} name={key} type="hidden" value={value} />)}
          <label>
            排序
            <select defaultValue={filters.sortBy} name="sort">
              <option value="publication_year">发表年份</option>
              <option value="standard_name">多糖名称</option>
              <option value="source_species">来源物种</option>
              <option value="evidence_level">证据等级</option>
              <option value="review_status">审核状态</option>
            </select>
          </label>
          <label>
            每页
            <select defaultValue={result.pageSize} name="pageSize">
              <option value="25">25 条</option>
              <option value="50">50 条</option>
              <option value="100">100 条</option>
            </select>
          </label>
          <button className="button button--quiet" type="submit">应用</button>
          <Link className="text-link" href="/database">清空筛选</Link>
        </form>
      </section>

      <RecordTable
        currentQuery={query.toString()}
        records={result.records}
      />

      <nav className="pagination" aria-label="检索结果分页">
        <PageLink disabled={result.page <= 1} label="上一页" page={result.page - 1} query={query} />
        <span>
          第 {result.page} 页 / 共 {Math.max(result.totalPages, 1)} 页
        </span>
        <PageLink
          disabled={result.totalPages === 0 || result.page >= result.totalPages}
          label="下一页"
          page={result.page + 1}
          query={query}
        />
      </nav>
    </main>
  );
}

function PageLink({
  disabled,
  label,
  page,
  query,
}: {
  disabled: boolean;
  label: string;
  page: number;
  query: URLSearchParams;
}) {
  if (disabled) return <span className="button button--quiet is-disabled">{label}</span>;
  const nextQuery = new URLSearchParams(query);
  nextQuery.set("page", String(page));
  return <Link className="button button--quiet" href={`/database?${nextQuery}`}>{label}</Link>;
}
