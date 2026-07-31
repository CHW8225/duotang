export type RecordLifecycleErrorCode =
  | "REASON_REQUIRED"
  | "REASON_TOO_LONG"
  | "NAME_MISMATCH"
  | "NOT_ACTIVE"
  | "NOT_DELETED";

export class RecordLifecycleError extends Error {
  constructor(public readonly code: RecordLifecycleErrorCode, message: string) {
    super(message);
    this.name = "RecordLifecycleError";
  }
}

export function validateDeletionReason(reason: string) {
  const normalized = reason.trim();
  if (!normalized) throw new RecordLifecycleError("REASON_REQUIRED", "请输入删除原因");
  if ([...normalized].length > 500) {
    throw new RecordLifecycleError("REASON_TOO_LONG", "删除原因不能超过 500 个字符");
  }
  return normalized;
}
