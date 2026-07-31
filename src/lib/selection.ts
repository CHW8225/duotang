export const MAX_SELECTED_RECORDS = 10;

type SelectionResult = {
  ids: string[];
  error?: string;
};

export function toggleRecordSelection(selectedIds: string[], id: string): SelectionResult {
  if (selectedIds.includes(id)) {
    return { ids: selectedIds.filter((selectedId) => selectedId !== id) };
  }
  if (selectedIds.length >= MAX_SELECTED_RECORDS) {
    return {
      ids: [...selectedIds],
      error: "最多可选择 10 条记录，请先取消部分选择。",
    };
  }
  return { ids: [...selectedIds, id] };
}

export function selectPageRecords(
  selectedIds: string[],
  pageIds: string[],
): SelectionResult {
  const uniqueIds = pageIds.filter((id) => !selectedIds.includes(id));
  const allowance = Math.max(0, MAX_SELECTED_RECORDS - selectedIds.length);
  const addedIds = uniqueIds.slice(0, allowance);
  const ids = [...selectedIds, ...addedIds];

  if (addedIds.length < uniqueIds.length) {
    return {
      ids,
      error: `已选择前 ${addedIds.length} 条，本次最多可保留 10 条记录。`,
    };
  }
  return { ids };
}
