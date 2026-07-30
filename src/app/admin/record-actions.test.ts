import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/db", () => ({
  createRecord: mocks.createRecord,
  updateRecord: mocks.updateRecord,
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createRecordAction,
  updateRecordAction,
} from "./(protected)/records/actions";
import { initialRecordActionState } from "../../lib/record-validation";

function validFormData() {
  const formData = new FormData();
  formData.set("standard_name", "测试多糖");
  formData.set("publication_year", "2026");
  formData.set("review_status", "待审核");
  return formData;
}

describe("后台记录 Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ username: "administrator" });
  });

  it("拒绝无效新记录且不写入数据库", async () => {
    const formData = validFormData();
    formData.set("standard_name", "");

    const state = await createRecordAction(initialRecordActionState, formData);

    expect(state.fieldErrors.standard_name).toBe("标准名称为必填项");
    expect(mocks.createRecord).not.toHaveBeenCalled();
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
  });

  it("验证通过后创建记录并刷新路径", async () => {
    mocks.createRecord.mockImplementation(async (record) => ({
      ...record,
      id: "poly-created",
    }));

    await expect(
      createRecordAction(initialRecordActionState, validFormData()),
    ).rejects.toThrow("REDIRECT:/admin/records/poly-created/edit");

    expect(mocks.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        standard_name: "测试多糖",
        publication_year: 2026,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/database");
  });

  it("无效编辑不会更新现有记录", async () => {
    const formData = validFormData();
    formData.set("publication_year", "NaN");

    const state = await updateRecordAction(
      "poly-0001",
      initialRecordActionState,
      formData,
    );

    expect(state.fieldErrors.publication_year).toBeDefined();
    expect(mocks.updateRecord).not.toHaveBeenCalled();
  });

  it("验证通过后更新现有记录", async () => {
    mocks.updateRecord.mockImplementation(async (id, record) => ({ ...record, id }));

    await expect(
      updateRecordAction(
        "poly-0001",
        initialRecordActionState,
        validFormData(),
      ),
    ).rejects.toThrow("REDIRECT:/admin/records/poly-0001/edit");

    expect(mocks.updateRecord).toHaveBeenCalledWith(
      "poly-0001",
      expect.objectContaining({ publication_year: 2026 }),
    );
  });
});
