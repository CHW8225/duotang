import ExcelJS from "exceljs";

import importManifest from "../../data/import/polysaccharide-import-manifest.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "./fields";
import type { RecordFilters } from "./search";
import { TERMINOLOGY_VERSION } from "./terminology";

type ExportKey = "id" | keyof PolysaccharideRecord;

export const exportColumns: Array<{ key: ExportKey; label: string }> = [
  { key: "id", label: "记录 ID" },
  ...FIELD_DEFINITIONS.map(({ key, label }) => ({ key, label })),
];

type ExportMetadata = {
  exportedAt: string;
  filterDescription: string;
};

const textValue = (value: PolysaccharideRecord[ExportKey]) => {
  if (Array.isArray(value)) return value.join("；");
  return value === null || value === undefined ? "" : String(value);
};

const escapeCsv = (value: string) => {
  const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safeValue)
    ? `"${safeValue.replaceAll('"', '""')}"`
    : safeValue;
};

export function describeFilters(filters: RecordFilters) {
  const descriptions = [
    filters.keyword && `关键词：${filters.keyword}`,
    filters.activityCategory && `活性：${filters.activityCategory}`,
    filters.species && `物种：${filters.species}`,
    filters.yearFrom && `年份从：${filters.yearFrom}`,
    filters.yearTo && `年份至：${filters.yearTo}`,
    filters.sourceCategory && `来源类别：${filters.sourceCategory}`,
    filters.evidenceLevel && `证据等级：${filters.evidenceLevel}`,
    filters.experimentType && `实验类型：${filters.experimentType}`,
    filters.structureCompleteness && `结构完整度：${filters.structureCompleteness}`,
    filters.monosaccharide && `单糖组成：${filters.monosaccharide}`,
    filters.hasDoi !== undefined && `DOI：${filters.hasDoi ? "有" : "无"}`,
  ].filter(Boolean);
  return descriptions.length ? descriptions.join("；") : "全部记录";
}

export function buildCsvExport(
  records: PolysaccharideRecord[],
  metadata: ExportMetadata,
) {
  const metadataColumns = [
    { key: "dataVersion", label: "数据集版本", value: importManifest.source_sha256 },
    { key: "terminologyVersion", label: "术语规则版本", value: TERMINOLOGY_VERSION },
    { key: "exportedAt", label: "导出时间", value: metadata.exportedAt },
    { key: "filters", label: "筛选条件", value: metadata.filterDescription },
  ];
  const header = [
    ...exportColumns.map(({ label }) => escapeCsv(label)),
    ...metadataColumns.map(({ label }) => escapeCsv(label)),
  ].join(",");
  const rows = records.map((record) =>
    [
      ...exportColumns.map(({ key }) => escapeCsv(textValue(record[key]))),
      ...metadataColumns.map(({ value }) => escapeCsv(value)),
    ].join(","),
  );
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}

export async function buildExcelExport(
  records: PolysaccharideRecord[],
  metadata: ExportMetadata,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "多糖科研数据库";
  workbook.created = new Date(metadata.exportedAt);

  const information = workbook.addWorksheet("导出说明");
  information.addRows([
    ["数据集版本", importManifest.source_sha256],
    ["术语规则版本", TERMINOLOGY_VERSION],
    ["导出时间", metadata.exportedAt],
    ["筛选条件", metadata.filterDescription],
    ["记录数量", records.length],
    ["说明", "空白单元格表示原始数据未记录；本文件未推断或补造缺失科研数据。"],
  ]);
  information.getColumn(1).width = 16;
  information.getColumn(2).width = 90;
  information.getRow(1).font = { bold: true };

  const sheet = workbook.addWorksheet("数据记录", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = exportColumns.map(({ key, label }) => ({
    key,
    header: label,
    width: Math.min(42, Math.max(12, label.length * 2)),
  }));
  records.forEach((record) => {
    sheet.addRow(
      Object.fromEntries(exportColumns.map(({ key }) => [key, textValue(record[key])])),
    );
  });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF126E73" },
  };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: exportColumns.length },
  };

  return workbook.xlsx.writeBuffer();
}
