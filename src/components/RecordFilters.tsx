"use client";

import { useMemo, useState } from "react";

import type { PolysaccharideRecord } from "@/lib/fields";
import { activityFacetValues, filterRecords } from "@/lib/search";
import { RecordTable } from "./RecordTable";

type OptionField = "activity_category";

const filterFields: Array<[OptionField, string]> = [
  ["activity_category", "活性类别"],
];

const uniqueValues = (records: PolysaccharideRecord[], field: OptionField) =>
  field === "activity_category" ? activityFacetValues(records) : [];

export function RecordFilters({ records }: { records: PolysaccharideRecord[] }) {
  const [keyword, setKeyword] = useState("");
  const [activityCategory, setActivityCategory] = useState("");

  const options = useMemo(
    () => Object.fromEntries(filterFields.map(([field]) => [field, uniqueValues(records, field)])),
    [records],
  );
  const filteredRecords = useMemo(
    () => filterRecords(records, {
      keyword,
      activityCategory,
    }),
    [activityCategory, keyword, records],
  );

  const resetFilters = () => {
    setKeyword("");
    setActivityCategory("");
  };

  return (
    <>
      <section aria-label="数据库筛选" className="filters">
        <label className="filter-field filter-field--wide">
          <span>关键词搜索</span>
          <input onChange={(event) => setKeyword(event.target.value)} placeholder="搜索名称、物种、活性、DOI" value={keyword} />
        </label>
        {filterFields.map(([field, label]) => {
          const value = { activity_category: activityCategory }[field];
          const setValue = { activity_category: setActivityCategory }[field];
          return <label className="filter-field" key={field}><span>{label}</span><select onChange={(event) => setValue(event.target.value)} value={value}><option value="">全部</option>{options[field].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
        })}
        <button className="button button--quiet" onClick={resetFilters} type="button">重置筛选</button>
      </section>
      <div className="results-heading"><p><strong>{filteredRecords.length}</strong> 条记录</p><span>按发表年份排序</span></div>
      <RecordTable records={filteredRecords} />
    </>
  );
}
