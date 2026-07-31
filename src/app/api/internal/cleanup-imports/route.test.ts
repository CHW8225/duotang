import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), cleanup: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ authorizeCronRequest: mocks.authorize }));
vi.mock("@/lib/admin-import-repository", () => ({ cleanupExpiredImportJobs: mocks.cleanup }));
import { POST } from "./route";

describe("导入预览 cron API", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("未授权时返回401且不清理", async () => {
    mocks.authorize.mockReturnValue(false);
    const response = await POST(new Request("http://localhost/api/internal/cleanup-imports", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it("授权后独立执行清理并返回删除数量", async () => {
    mocks.authorize.mockReturnValue(true); mocks.cleanup.mockResolvedValue({ deletedJobs: 3 });
    const response = await POST(new Request("http://localhost/api/internal/cleanup-imports", { method: "POST", headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedJobs: 3 });
  });
});
