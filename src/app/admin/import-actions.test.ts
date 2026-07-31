import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), inspect: vi.fn(), parse: vi.fn(), create: vi.fn(), confirm: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/admin-import", () => ({ inspectImportFile: mocks.inspect, parseImportWorkbook: mocks.parse }));
vi.mock("@/lib/admin-import-repository", () => ({ createImportPreview: mocks.create, confirmImportJob: mocks.confirm, ImportConflictError: class extends Error {}, ImportStateError: class extends Error {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { confirmImportAction, uploadImportAction } from "./(protected)/import/actions";

describe("管理员批量导入 Actions", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireAdmin.mockResolvedValue({ username: "admin" }); });
  it("上传先鉴权并只把服务端解析结果保存为预览", async () => {
    const file = new File(["data"], "data.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const data = new FormData(); data.set("file", file);
    mocks.parse.mockResolvedValue({ rows: [{ rowNumber: 2 }] }); mocks.create.mockResolvedValue({ id: "job", status: "ready" });
    const state = await uploadImportAction({ status: "idle" }, data);
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.inspect).toHaveBeenCalledWith(expect.objectContaining({ name: "data.xlsx" }));
    expect(mocks.create).toHaveBeenCalledWith("data.xlsx", "admin", [{ rowNumber: 2 }]);
    expect(state).toMatchObject({ status: "success", jobId: "job" });
  });
  it("确认重新鉴权且客户端只能指定任务ID", async () => {
    mocks.confirm.mockResolvedValue({ importedRows: 2 });
    const data = new FormData(); data.set("jobId", "job"); data.set("rows", "tampered");
    const state = await confirmImportAction({ status: "idle" }, data);
    expect(mocks.requireAdmin).toHaveBeenCalledOnce(); expect(mocks.confirm).toHaveBeenCalledWith("job", "admin");
    expect(state).toMatchObject({ status: "success", message: expect.stringContaining("2") });
  });
});
