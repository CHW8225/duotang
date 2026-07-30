import { beforeEach, describe, expect, it, vi } from "vitest";

import importedRecords from "../../../data/import/polysaccharide-records.json";
import { FIELD_DEFINITIONS, type PolysaccharideRecord } from "../../lib/fields";

const mocks = vi.hoisted(() => ({
  createRecord: vi.fn(),
  getRecordById: vi.fn(),
  updateRecord: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/db", () => ({
  createRecord: mocks.createRecord,
  getRecordById: mocks.getRecordById,
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

function recordFormData(record: PolysaccharideRecord) {
  const formData = new FormData();
  FIELD_DEFINITIONS.forEach(({ key }) => {
    formData.set(key, String(record[key] ?? ""));
  });
  return formData;
}

describe("后台记录 Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ username: "administrator" });
    mocks.getRecordById.mockResolvedValue(importedRecords[0]);
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

  it("只修改其他字段时允许保留遗留 DOI 和 URL 原文", async () => {
    const existing = {
      ...(importedRecords[0] as PolysaccharideRecord),
      doi: "legacy DOI value",
      source_url: "legacy source reference",
    };
    mocks.getRecordById.mockResolvedValue(existing);
    mocks.updateRecord.mockImplementation(async (id, record) => ({ ...record, id }));
    const formData = recordFormData(existing);
    formData.set("standard_name", "仅修改名称");

    await expect(
      updateRecordAction("poly-0001", initialRecordActionState, formData),
    ).rejects.toThrow("REDIRECT:/admin/records/poly-0001/edit");

    expect(mocks.updateRecord).toHaveBeenCalledWith(
      "poly-0001",
      expect.objectContaining({
        standard_name: "仅修改名称",
        doi: "legacy DOI value",
        source_url: "legacy source reference",
      }),
    );
  });

  it("拒绝把遗留 DOI 或 URL 改成新的非法值", async () => {
    const existing = {
      ...(importedRecords[0] as PolysaccharideRecord),
      doi: "legacy DOI value",
      source_url: "legacy source reference",
    };
    mocks.getRecordById.mockResolvedValue(existing);
    const formData = recordFormData(existing);
    formData.set("doi", "changed invalid DOI");
    formData.set("source_url", "changed invalid URL");

    const state = await updateRecordAction(
      "poly-0001",
      initialRecordActionState,
      formData,
    );

    expect(state.fieldErrors.doi).toBeDefined();
    expect(state.fieldErrors.source_url).toBeDefined();
    expect(mocks.updateRecord).not.toHaveBeenCalled();
  });

  it("记录不存在时保持重定向到后台列表", async () => {
    mocks.getRecordById.mockResolvedValue(null);

    await expect(
      updateRecordAction(
        "missing-record",
        initialRecordActionState,
        validFormData(),
      ),
    ).rejects.toThrow("REDIRECT:/admin/records");

    expect(mocks.requireAdmin).toHaveBeenCalledBefore(mocks.getRecordById);
    expect(mocks.updateRecord).not.toHaveBeenCalled();
  });
});
