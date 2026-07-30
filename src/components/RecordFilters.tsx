"use client";

import { useMemo, useState } from "react";

import type { PolysaccharideRecord } from "@/lib/fields";
import { activityFacetValues, filterRecords } from "@/lib/search";
import { RecordTable } from "./RecordTable";

type OptionField = "source_category" | "activity_category" | "evidence_level" | "structure_completeness" | "review_status";

const filterFields: Array<[OptionField, string]> = [
  ["source_category", "来源类别"],
  ["activity_category", "活性类别"],
  ["evidence_level", "证据等级"],
  ["structure_completeness", "结构完整度"],
  ["review_status", "审核状态"],
];

const uniqueValues = (records: PolysaccharideRecord[], field: OptionField) =>
  field === "activity_category"
    ? activityFacetValues(records)
    : [...new Set(records.map((record) => record[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export function RecordFilters({ records }: { records: PolysaccharideRecord[] }) {
  const [keyword, setKeyword] = useState("");
  const [sourceCategory, setSourceCategory] = useState("");
  const [activityCategory, setActivityCategory] = useState("");
  const [evidenceLevel, setEvidenceLevel] = useState("");
  const [structureCompleteness, setStructureCompleteness] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const options = useMemo(
    () => Object.fromEntries(filterFields.map(([field]) => [field, uniqueValues(records, field)])),
    [records],
  );
  const filteredRecords = useMemo(
    () => filterRecords(records, {
      keyword,
      sourceCategory,
      activityCategory,
      evidenceLevel,
      structureCompleteness,
      reviewStatus,
      yearFrom: yearFrom ? Number(yearFrom) : undefined,
      yearTo: yearTo ? Number(yearTo) : undefined,
    }),
    [activityCategory, evidenceLevel, keyword, records, reviewStatus, sourceCategory, structureCompleteness, yearFrom, yearTo],
  );

  const resetFilters = () => {
    setKeyword(""); setSourceCategory(""); setActivityCategory(""); setEvidenceLevel("");
    setStructureCompleteness(""); setReviewStatus(""); setYearFrom(""); setYearTo("");
  };

  return (
    <>
      <section aria-label="数据库筛选" className="filters">
        <label className="filter-field filter-field--wide">
          <span>关键字</span>
          <input onChange={(event) => setKeyword(event.target.value)} placeholder="名称、物种、DOI、作用机制..." value={keyword} />
        </label>
        {filterFields.map(([field, label]) => {
          const value = { source_category: sourceCategory, activity_category: activityCategory, evidence_level: evidenceLevel, structure_completeness: structureCompleteness, review_status: reviewStatus }[field];
          const setValue = { source_category: setSourceCategory, activity_category: setActivityCategory, evidence_level: setEvidenceLevel, structure_completeness: setStructureCompleteness, review_status: setReviewStatus }[field];
          return <label className="filter-field" key={field}><span>{label}</span><select onChange={(event) => setValue(event.target.value)} value={value}><option value="">全部</option>{options[field].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
        })}
        <label className="filter-field"><span>起始年份</span><input inputMode="numeric" min="1900" onChange={(event) => setYearFrom(event.target.value)} type="number" value={yearFrom} /></label>
        <label className="filter-field"><span>截止年份</span><input inputMode="numeric" min="1900" onChange={(event) => setYearTo(event.target.value)} type="number" value={yearTo} /></label>
        <button className="button button--quiet" onClick={resetFilters} type="button">重置筛选</button>
      </section>
      <div className="results-heading"><p><strong>{filteredRecords.length}</strong> 条记录</p><span>按发表年份排序</span></div>
      <RecordTable records={filteredRecords} />
    </>
  );
}
