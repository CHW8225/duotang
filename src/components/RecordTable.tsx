"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  getDisplayDoi,
  getMonosaccharideComposition,
  getMonosaccharideRatio,
  getPolysaccharideDisplayName,
} from "../lib/display";
import type { PolysaccharideRecord } from "@/lib/fields";
import {
  MAX_SELECTED_RECORDS,
  selectPageRecords,
  toggleRecordSelection,
} from "../lib/selection";
import {
  getBilingualSpeciesName,
  normalizePrimaryActivityCategories,
  normalizeEvidenceLevel,
} from "../lib/terminology";
import { QualityBadge } from "./QualityBadge";

const STORAGE_KEY = "polysaccharide-selected-records";

type Props = {
  records: PolysaccharideRecord[];
  currentQuery?: string;
};

export function RecordTable({ records, currentQuery = "" }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<PolysaccharideRecord[]>([]);
  const [onlySelected, setOnlySelected] = useState(false);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [message, setMessage] = useState("");
  const selectionLoaded = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
        const validIds = Array.isArray(stored)
          ? [...new Set(stored.filter(
            (id): id is string => typeof id === "string" && Boolean(id.trim()),
          ))]
            .slice(0, MAX_SELECTED_RECORDS)
          : [];
        selectionLoaded.current = true;
        setSelectedIds(validIds);
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
        selectionLoaded.current = true;
      }
    });
  }, []);

  useEffect(() => {
    if (selectionLoaded.current) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
    }
  }, [selectedIds]);

  const visibleRecords = onlySelected ? selectedRecords : records;

  const updateSelection = (result: { ids: string[]; error?: string }) => {
    setSelectedIds(result.ids);
    setSelectedRecords((current) =>
      current.filter((record) => result.ids.includes(record.id)),
    );
    setMessage(result.error ?? "");
  };

  const toggleOnlySelected = async (checked: boolean) => {
    if (!checked) {
      setOnlySelected(false);
      setSelectedRecords([]);
      return;
    }
    setLoadingSelected(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/records/selected?ids=${encodeURIComponent(selectedIds.join(","))}`,
      );
      if (!response.ok) throw new Error("request failed");
      const payload = await response.json() as { records?: PolysaccharideRecord[] };
      const validRecords = Array.isArray(payload.records) ? payload.records : [];
      setSelectedRecords(validRecords);
      setSelectedIds(validRecords.map(({ id }) => id));
      setOnlySelected(true);
    } catch {
      setMessage("暂时无法加载已选记录，请稍后重试。");
    } finally {
      setLoadingSelected(false);
    }
  };

  const exportQuery = new URLSearchParams(currentQuery);
  exportQuery.delete("page");
  const selectedExportQuery = new URLSearchParams();
  selectedExportQuery.set("ids", selectedIds.join(","));

  return (
    <section className="record-results">
      <div className="selection-toolbar">
        <div className="selection-toolbar__actions">
          <button
            className="button button--quiet"
            onClick={() => updateSelection(selectPageRecords(selectedIds, records.map(({ id }) => id)))}
            type="button"
          >
            全选本页
          </button>
          <button
            className="button button--quiet"
            disabled={selectedIds.length === 0}
            onClick={() => {
              setSelectedIds([]);
              setMessage("");
            }}
            type="button"
          >
            清空选择
          </button>
          <label className="selection-toggle">
            <input
              checked={onlySelected}
              disabled={selectedIds.length === 0}
              onChange={(event) => void toggleOnlySelected(event.target.checked)}
              type="checkbox"
            />
            {loadingSelected ? "正在加载..." : "仅查看已选记录"}
          </label>
        </div>
        <div className="selection-toolbar__status">
          <span>已选 {selectedIds.length}/{MAX_SELECTED_RECORDS} 条</span>
          <a className="text-link" href={`/api/export/csv?${exportQuery}`}>导出筛选结果 CSV</a>
          <a className="text-link" href={`/api/export/xlsx?${exportQuery}`}>导出筛选结果 Excel</a>
          {selectedIds.length > 0 && (
            <>
              <a className="text-link" href={`/api/export/csv?${selectedExportQuery}`}>
                已选 CSV
              </a>
              <a className="text-link" href={`/api/export/xlsx?${selectedExportQuery}`}>
                已选 Excel
              </a>
            </>
          )}
        </div>
      </div>
      {message && <p className="selection-message" role="status">{message}</p>}

      <div className="table-wrap">
        <table className="record-table">
          <colgroup>
            <col className="record-table__col-select" />
            <col className="record-table__col-name" />
            <col className="record-table__col-species" />
            <col className="record-table__col-composition" />
            <col className="record-table__col-ratio" />
            <col className="record-table__col-activity" />
            <col className="record-table__col-evidence" />
            <col className="record-table__col-year" />
            <col className="record-table__col-doi" />
            <col className="record-table__col-detail" />
          </colgroup>
          <thead>
            <tr>
              <th className="record-table__select">
                <span className="sr-only">选择记录</span>
              </th>
              <th className="record-table__sticky">多糖名称</th>
              <th>来源物种</th>
              <th>单糖组成</th>
              <th>组成比例</th>
              <th>活性类别</th>
              <th>证据等级</th>
              <th>年份</th>
              <th>DOI</th>
              <th><span className="sr-only">查看记录</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.length === 0 ? (
              <tr>
                <td className="record-table__empty" colSpan={10}>
                  {onlySelected
                    ? "没有可显示的已选记录，请关闭“仅查看已选记录”后重新选择。"
                    : "没有符合当前筛选条件的记录，请调整或清空筛选条件。"}
                </td>
              </tr>
            ) : visibleRecords.map((record) => {
              const composition = getMonosaccharideComposition(record);
              const ratio = getMonosaccharideRatio(record);
              const doi = getDisplayDoi(record);
              const displayName = getPolysaccharideDisplayName(record);
              const checked = selectedIds.includes(record.id);
              const returnTo = `/database?${currentQuery}`;

              return (
                <tr key={record.id}>
                  <td className="record-table__select">
                    <input
                      aria-label={`选择 ${displayName}`}
                      checked={checked}
                      onChange={() => updateSelection(toggleRecordSelection(selectedIds, record.id))}
                      type="checkbox"
                    />
                  </td>
                  <td className="record-table__primary record-table__sticky" title={displayName}>
                    {displayName}
                  </td>
                  <td title={getBilingualSpeciesName(record.source_species)}>
                    <span className="record-table__clamp">
                      {getBilingualSpeciesName(record.source_species)}
                    </span>
                  </td>
                  <td className="record-table__composition" title={composition}>
                    <span>{composition}</span>
                  </td>
                  <td className="record-table__ratio" title={ratio}>{ratio}</td>
                  <td className="record-table__badge"><QualityBadge originalValue={record.activity_category} value={normalizePrimaryActivityCategories(record.activity_category).join("、")} /></td>
                  <td className="record-table__badge"><QualityBadge originalValue={record.evidence_level} value={normalizeEvidenceLevel(record.evidence_level)} /></td>
                  <td>{record.publication_year ?? "-"}</td>
                  <td className="record-table__doi" title={doi}>
                    {record.doi ? (
                      <a href={`https://doi.org/${record.doi}`} rel="noreferrer" target="_blank">
                        {doi}
                      </a>
                    ) : "未收录"}
                  </td>
                  <td>
                    <Link
                      className="text-link record-table__detail"
                      href={`/records/${record.id}?returnTo=${encodeURIComponent(returnTo)}`}
                    >
                      查看详情
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
