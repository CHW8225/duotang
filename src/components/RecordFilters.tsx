import type { RecordFilters as Filters } from "@/lib/search";

export type FilterOptions = {
  activities: string[];
  species: string[];
  sourceCategories: string[];
  evidenceLevels: string[];
  structureCompleteness: string[];
  years: number[];
};

type Props = {
  filters: Filters;
  options: FilterOptions;
};

const optionList = (values: string[]) =>
  values.map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));

export function RecordFilters({ filters, options }: Props) {
  return (
    <form action="/database" className="search-workbench" method="get">
      <div className="search-workbench__core">
        <label className="filter-field filter-field--keyword">
          <span>关键词</span>
          <input
            defaultValue={filters.keyword}
            name="keyword"
            placeholder="名称、物种、活性、单糖组成或 DOI"
          />
        </label>
        <label className="filter-field">
          <span>活性类别</span>
          <select defaultValue={filters.activityCategory ?? ""} name="activity">
            <option value="">全部活性</option>
            {optionList(options.activities)}
          </select>
        </label>
        <label className="filter-field">
          <span>来源物种</span>
          <input
            defaultValue={filters.species}
            list="species-options"
            name="species"
            placeholder="输入中文名或拉丁名"
          />
          <datalist id="species-options">{optionList(options.species)}</datalist>
        </label>
        <label className="filter-field filter-field--year">
          <span>发表年份</span>
          <span className="year-range">
            <input
              aria-label="起始年份"
              defaultValue={filters.yearFrom}
              max={options.years.at(-1)}
              min={options.years[0]}
              name="yearFrom"
              placeholder="起始"
              type="number"
            />
            <span>至</span>
            <input
              aria-label="结束年份"
              defaultValue={filters.yearTo}
              max={options.years.at(-1)}
              min={options.years[0]}
              name="yearTo"
              placeholder="结束"
              type="number"
            />
          </span>
        </label>
        <button className="button" type="submit">检索</button>
      </div>

      <details className="advanced-filters">
        <summary>高级筛选</summary>
        <div className="advanced-filters__grid">
          <label className="filter-field">
            <span>来源类别</span>
            <select defaultValue={filters.sourceCategory ?? ""} name="sourceCategory">
              <option value="">全部类别</option>
              {optionList(options.sourceCategories)}
            </select>
          </label>
          <label className="filter-field">
            <span>证据等级</span>
            <select defaultValue={filters.evidenceLevel ?? ""} name="evidence">
              <option value="">全部等级</option>
              {optionList(options.evidenceLevels)}
            </select>
          </label>
          <label className="filter-field">
            <span>结构完整度</span>
            <select
              defaultValue={filters.structureCompleteness ?? ""}
              name="structureCompleteness"
            >
              <option value="">全部状态</option>
              {optionList(options.structureCompleteness)}
            </select>
          </label>
          <label className="filter-field">
            <span>DOI 收录</span>
            <select
              defaultValue={
                filters.hasDoi === undefined ? "" : filters.hasDoi ? "true" : "false"
              }
              name="hasDoi"
            >
              <option value="">不限</option>
              <option value="true">有 DOI</option>
              <option value="false">无 DOI</option>
            </select>
          </label>
        </div>
      </details>
      <input name="pageSize" type="hidden" value={filters.pageSize} />
      <input name="sort" type="hidden" value={filters.sortBy} />
    </form>
  );
}
