import Link from "next/link";

import {
  getMonosaccharideComposition,
  getMonosaccharideRatio,
} from "../lib/display";
import type { PolysaccharideRecord } from "@/lib/fields";
import { QualityBadge } from "./QualityBadge";

export function RecordTable({ records }: { records: PolysaccharideRecord[] }) {
  return (
    <div className="table-wrap">
      <table className="record-table">
        <thead>
          <tr>
            <th>标准名称</th>
            <th>英文名称</th>
            <th>来源物种</th>
            <th>年份</th>
            <th>活性类别</th>
            <th>证据等级</th>
            <th>单糖组成</th>
            <th>组成比例</th>
            <th><span className="sr-only">查看记录</span></th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td className="record-table__empty" colSpan={9}>
                没有符合当前筛选条件的记录，请调整或重置筛选条件。
              </td>
            </tr>
          ) : records.map((record) => {
            const composition = getMonosaccharideComposition(record);
            const ratio = getMonosaccharideRatio(record);

            return (
              <tr key={record.id}>
                <td className="record-table__primary">{record.standard_name || "未记录"}</td>
                <td>{record.english_name || "未记录"}</td>
                <td>{record.source_species || "未记录"}</td>
                <td>{record.publication_year ?? "-"}</td>
                <td><QualityBadge value={record.activity_category} /></td>
                <td><QualityBadge value={record.evidence_level} /></td>
                <td className="record-table__composition" title={composition}>
                  <span>{composition}</span>
                </td>
                <td className="record-table__ratio">{ratio}</td>
                <td><Link className="text-link" href={`/records/${record.id}`}>查看详情</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
