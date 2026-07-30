# 多糖科研数据库中文化与列表改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用“单糖组成”和“组成比例”替换公开数据库列表中的 `STRUCTURE`、`REVIEW` 两列，完成全站中文化，并将界面升级为克制、清晰的科研科技风格。

**Architecture:** 保持 `PolysaccharideRecord`、Excel 导入、运行时存储和后台保存流程不变，只在展示层增加单糖组成回退函数并调整组件。前台与后台中文化分别实施和测试，最后集中调整全局视觉系统并进行桌面与手机浏览器验收。

**Tech Stack:** Next.js 16、React 19、TypeScript 5、Vitest、现有全局 CSS、Codex in-app browser。

## Global Constraints

- 公开数据库列表删除 `STRUCTURE` 和 `REVIEW` 两列，新增“单糖组成”和“组成比例”两列。
- “单糖组成”优先使用 `monosaccharide_standardized`，空白时回退到 `monosaccharide_original`，两者均为空时显示“未记录”。
- “组成比例”使用 `monosaccharide_ratio`，空白时显示“未记录”。
- 单糖组成最多显示两行，并通过原生 `title` 提供当前实际值的完整文本。
- `structure_completeness` 和 `review_status` 数据、详情展示、筛选能力及后台编辑能力必须保留。
- 所有用户界面文案使用中文；英文名称、DOI、物种拉丁名、期刊名、英文文献标题和已有科研数据保持原文。
- 不新增第三方依赖，不改变数据模型，不改动 Excel 导入或运行时存储格式。
- 视觉使用白色、浅灰、深灰、青绿色和少量亮青色；不使用大面积渐变、装饰性光球或营销式卡片堆叠。
- 窄屏仅允许表格容器内部横向滚动，不允许页面级横向溢出。
- 保留工作树中与本计划无关的 `next-env.d.ts` 现有改动，不纳入本计划提交。

---

## File Structure

- Create: `src/lib/display.ts` - 纯展示值回退函数。
- Create: `src/lib/display.test.ts` - 单糖组成和比例的回退测试。
- Create: `src/components/RecordTable.test.tsx` - 表格列、完整悬停文本和空状态测试。
- Create: `src/app/public-copy.test.ts` - 公开页面关键中文文案回归测试。
- Create: `src/app/admin/admin-copy.test.ts` - 后台关键中文文案回归测试。
- Modify: `src/components/RecordTable.tsx` - 替换列表列并应用展示值。
- Modify: `src/components/RecordFilters.tsx` - 中文筛选器和结果提示。
- Modify: `src/components/SiteHeader.tsx` - 中文品牌与导航。
- Modify: `src/components/RecordDetailSections.tsx` - 中文分组、空值与来源链接。
- Modify: `src/components/QualityBadge.tsx` - 中文空值。
- Modify: `src/components/AdminShell.tsx` - 中文后台导航。
- Modify: `src/components/AdminRecordForm.tsx` - 中文表单分组。
- Modify: `src/app/layout.tsx` - 中文元数据和页面语言。
- Modify: `src/app/page.tsx` - 中文首页。
- Modify: `src/app/database/page.tsx` - 中文数据库页。
- Modify: `src/app/dictionary/page.tsx` - 中文数据字典。
- Modify: `src/app/quality/page.tsx` - 中文质量页面。
- Modify: `src/app/records/[id]/page.tsx` - 中文详情页。
- Modify: `src/app/admin/login/page.tsx` - 中文登录页。
- Modify: `src/app/admin/login/LoginForm.tsx` - 中文登录表单。
- Modify: `src/app/admin/login/actions.ts` - 中文登录错误。
- Modify: `src/app/admin/(protected)/page.tsx` - 中文后台概览。
- Modify: `src/app/admin/(protected)/records/page.tsx` - 中文后台列表与筛选。
- Modify: `src/app/admin/(protected)/records/new/page.tsx` - 中文新建页。
- Modify: `src/app/admin/(protected)/records/[id]/edit/page.tsx` - 中文编辑页。
- Modify: `src/app/globals.css` - 科研科技视觉、两行截断和响应式样式。

---

### Task 1: 单糖展示规则与公开列表列

**Files:**
- Create: `src/lib/display.ts`
- Create: `src/lib/display.test.ts`
- Create: `src/components/RecordTable.test.tsx`
- Modify: `src/components/RecordTable.tsx`

**Interfaces:**
- Consumes: `PolysaccharideRecord` 中的 `monosaccharide_standardized`、`monosaccharide_original` 和 `monosaccharide_ratio`。
- Produces: `getMonosaccharideComposition(record): string` 与 `getMonosaccharideRatio(record): string`，供 `RecordTable` 使用。

- [ ] **Step 1: 写单糖组成与比例的失败测试**

Create `src/lib/display.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  getMonosaccharideComposition,
  getMonosaccharideRatio,
} from "./display";

describe("getMonosaccharideComposition", () => {
  it("优先显示标准化单糖组成", () => {
    expect(getMonosaccharideComposition({
      monosaccharide_standardized: "Glc:Gal",
      monosaccharide_original: "glucose and galactose",
    })).toBe("Glc:Gal");
  });

  it("标准化组成空白时回退到原始组成", () => {
    expect(getMonosaccharideComposition({
      monosaccharide_standardized: "   ",
      monosaccharide_original: "glucose and galactose",
    })).toBe("glucose and galactose");
  });

  it("两个组成字段均为空时显示未记录", () => {
    expect(getMonosaccharideComposition({
      monosaccharide_standardized: "",
      monosaccharide_original: "",
    })).toBe("未记录");
  });
});

describe("getMonosaccharideRatio", () => {
  it("比例空白时显示未记录", () => {
    expect(getMonosaccharideRatio({ monosaccharide_ratio: "  " })).toBe("未记录");
  });
});
```

- [ ] **Step 2: 运行展示值测试并确认因模块不存在而失败**

Run: `npm test -- src/lib/display.test.ts`

Expected: FAIL，提示无法解析 `./display`。

- [ ] **Step 3: 实现最小展示值函数**

Create `src/lib/display.ts`:

```ts
import type { PolysaccharideRecord } from "./fields";

type CompositionRecord = Pick<
  PolysaccharideRecord,
  "monosaccharide_standardized" | "monosaccharide_original"
>;

type RatioRecord = Pick<PolysaccharideRecord, "monosaccharide_ratio">;

function cleanDisplayValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function getMonosaccharideComposition(record: CompositionRecord) {
  return cleanDisplayValue(record.monosaccharide_standardized)
    || cleanDisplayValue(record.monosaccharide_original)
    || "未记录";
}

export function getMonosaccharideRatio(record: RatioRecord) {
  return cleanDisplayValue(record.monosaccharide_ratio) || "未记录";
}
```

- [ ] **Step 4: 运行展示值测试并确认通过**

Run: `npm test -- src/lib/display.test.ts`

Expected: 4 tests PASS。

- [ ] **Step 5: 写公开表格列的失败测试**

Create `src/components/RecordTable.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PolysaccharideRecord } from "@/lib/fields";
import { RecordTable } from "./RecordTable";

const record = {
  id: "record-1",
  standard_name: "示例多糖",
  english_name: "Example polysaccharide",
  source_species: "Ganoderma lucidum",
  publication_year: 2024,
  activity_category: "抗氧化",
  evidence_level: "细胞实验",
  structure_completeness: "完整",
  review_status: "待审核",
  monosaccharide_standardized: "Glc:Gal:Man",
  monosaccharide_original: "glucose, galactose and mannose",
  monosaccharide_ratio: "4:2:1",
} as PolysaccharideRecord;

describe("RecordTable", () => {
  it("用单糖组成和组成比例替换结构与审核列", () => {
    const html = renderToStaticMarkup(<RecordTable records={[record]} />);

    expect(html).toContain("<th>单糖组成</th>");
    expect(html).toContain("<th>组成比例</th>");
    expect(html).not.toContain("<th>Structure</th>");
    expect(html).not.toContain("<th>Review</th>");
    expect(html).toContain('title="Glc:Gal:Man"');
    expect(html).toContain(">4:2:1<");
    expect(html).toContain(">查看详情<");
  });

  it("没有匹配记录时显示中文空状态", () => {
    const html = renderToStaticMarkup(<RecordTable records={[]} />);

    expect(html).toContain("没有符合当前筛选条件的记录");
  });
});
```

- [ ] **Step 6: 运行表格测试并确认因旧列与英文文案而失败**

Run: `npm test -- src/components/RecordTable.test.tsx`

Expected: FAIL，找不到“单糖组成”“组成比例”和“查看详情”。

- [ ] **Step 7: 用新列和中文表头实现公开表格**

Modify `src/components/RecordTable.tsx`:

```tsx
import Link from "next/link";

import {
  getMonosaccharideComposition,
  getMonosaccharideRatio,
} from "@/lib/display";
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
```

- [ ] **Step 8: 运行任务测试和完整测试**

Run: `npm test -- src/lib/display.test.ts src/components/RecordTable.test.tsx`

Expected: 6 tests PASS。

Run: `npm test`

Expected: 全部测试 PASS。

- [ ] **Step 9: 提交任务**

```bash
git add src/lib/display.ts src/lib/display.test.ts src/components/RecordTable.tsx src/components/RecordTable.test.tsx
git commit -m "feat: show monosaccharide composition in records table"
```

---

### Task 2: 公开网站中文化

**Files:**
- Create: `src/app/public-copy.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/database/page.tsx`
- Modify: `src/app/dictionary/page.tsx`
- Modify: `src/app/quality/page.tsx`
- Modify: `src/app/records/[id]/page.tsx`
- Modify: `src/components/SiteHeader.tsx`
- Modify: `src/components/RecordFilters.tsx`
- Modify: `src/components/RecordDetailSections.tsx`
- Modify: `src/components/QualityBadge.tsx`

**Interfaces:**
- Consumes: 现有公共页面、字段定义和筛选逻辑。
- Produces: `lang="zh-CN"` 的全中文公共界面；科研记录字段值保持原文。

- [ ] **Step 1: 写公开页面中文文案的失败测试**

Create `src/app/public-copy.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("公开界面中文化", () => {
  it("页面语言和元数据使用中文", () => {
    const source = readSource("src/app/layout.tsx");

    expect(source).toContain('lang="zh-CN"');
    expect(source).toContain('title: "多糖科研数据库"');
  });

  it("关键公开页面不再使用旧英文操作文案", () => {
    const source = [
      "src/app/page.tsx",
      "src/app/database/page.tsx",
      "src/app/dictionary/page.tsx",
      "src/app/quality/page.tsx",
      "src/app/records/[id]/page.tsx",
      "src/components/SiteHeader.tsx",
      "src/components/RecordFilters.tsx",
      "src/components/RecordDetailSections.tsx",
      "src/components/QualityBadge.tsx",
    ].map(readSource).join("\n");

    for (const phrase of [
      "Search the database",
      "Browse and filter",
      "Data Dictionary",
      "Quality Dashboard",
      "Back to database",
      "Reset filters",
      "Open source",
      "Not recorded",
    ]) {
      expect(source).not.toContain(phrase);
    }
  });

  it("保留结构与审核筛选能力并使用中文标签", () => {
    const source = readSource("src/components/RecordFilters.tsx");

    expect(source).toContain('["structure_completeness", "结构完整度"]');
    expect(source).toContain('["review_status", "审核状态"]');
  });
});
```

- [ ] **Step 2: 运行测试并确认旧英文文案导致失败**

Run: `npm test -- src/app/public-copy.test.ts`

Expected: 3 tests FAIL，分别指出英文语言元数据、旧英文文案和英文筛选标签。

- [ ] **Step 3: 中文化布局、品牌和首页**

Apply these exact copy decisions:

```text
metadata.title = 多糖科研数据库
metadata.description = 面向多糖研究的标准化科研数据平台。
html lang = zh-CN
品牌标记 = 多糖
品牌名称 = 多糖科研数据库
导航 = 数据检索 / 数据字典 / 数据质量
首页眉题 = 标准化科研数据
首页标题 = 多糖科研数据库
首页说明 = 汇集多糖来源、结构、文献与生物活性信息的标准化科研数据平台
首页按钮 = 检索数据库
首页统计 = 收录记录 / 文献年份跨度 / 质量检查通过
首页分布 = 来源类别 / 生物活性类别 / 证据等级
```

Use `aria-label="数据库概览"` and `aria-label="数据分布概览"` for the two home sections.

- [ ] **Step 4: 中文化数据库筛选与结果区域**

Apply these exact labels in `src/components/RecordFilters.tsx`:

```text
数据库筛选
关键字
名称、物种、DOI、作用机制...
来源类别
活性类别
证据等级
结构完整度
审核状态
全部
起始年份
截止年份
重置筛选
{count} 条记录
按发表年份排序
```

Keep the existing state, filter mapping and reset behavior unchanged.

- [ ] **Step 5: 中文化数据库、字典、质量和详情页面**

Use the following exact group labels in both dictionary and detail sections:

```ts
{
  identity: "基本信息",
  literature: "文献信息",
  source: "来源与制备",
  structure: "结构信息",
  bioactivity: "生物活性",
  management: "数据管理",
}
```

Use these key copies:

```text
数据库页：数据检索 / 浏览与筛选 / 按来源、活性、证据等级、结构完整度、审核状态和发表年份检索标准化多糖记录。
字典页：数据规范 / 数据字典 / 查看每条多糖科研记录采用的字段定义与数据分组。
字典表头：字段键 / 中文名称 / 字段组 / 可编辑 / 是 / 否
质量页：数据治理概览 / 数据质量 / 质量标记来自导入记录，用于定位需要进一步科研核验和补充的数据。
质量统计：有质量标记的记录 / 未来年份记录 / 问题统计 / 受影响记录
详情页：返回数据检索 / 记录 {upload_id} / 未命名记录
来源链接：查看来源
空值：未记录
记录链接：查看记录
```

Keep English names, DOI links, source URLs and raw record values unchanged.

- [ ] **Step 6: 运行公开文案测试与完整测试**

Run: `npm test -- src/app/public-copy.test.ts`

Expected: 3 tests PASS。

Run: `npm test`

Expected: 全部测试 PASS。

- [ ] **Step 7: 审计公开界面残留英文文案**

Run:

```powershell
rg -n '"[^"]*[A-Za-z][^"]*"' src/app/page.tsx src/app/database/page.tsx src/app/dictionary/page.tsx src/app/quality/page.tsx 'src/app/records/[id]/page.tsx' src/components/SiteHeader.tsx src/components/RecordFilters.tsx src/components/RecordDetailSections.tsx src/components/QualityBadge.tsx
```

Expected: 仅保留代码标识、CSS 类名、URL、字段键、DOI 和用户科研数据相关英文；无英文按钮、标题、说明、空状态或无障碍文案。

- [ ] **Step 8: 提交任务**

```bash
git add src/app/public-copy.test.ts src/app/layout.tsx src/app/page.tsx src/app/database/page.tsx src/app/dictionary/page.tsx src/app/quality/page.tsx "src/app/records/[id]/page.tsx" src/components/SiteHeader.tsx src/components/RecordFilters.tsx src/components/RecordDetailSections.tsx src/components/QualityBadge.tsx
git commit -m "feat: localize public research interface"
```

---

### Task 3: 管理后台中文化

**Files:**
- Create: `src/app/admin/admin-copy.test.ts`
- Modify: `src/components/AdminShell.tsx`
- Modify: `src/components/AdminRecordForm.tsx`
- Modify: `src/app/admin/login/page.tsx`
- Modify: `src/app/admin/login/LoginForm.tsx`
- Modify: `src/app/admin/login/actions.ts`
- Modify: `src/app/admin/(protected)/page.tsx`
- Modify: `src/app/admin/(protected)/records/page.tsx`
- Modify: `src/app/admin/(protected)/records/new/page.tsx`
- Modify: `src/app/admin/(protected)/records/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: 现有管理员认证、记录筛选、新建和更新 Server Actions。
- Produces: 保持行为不变的全中文单管理员后台。

- [ ] **Step 1: 写后台中文文案的失败测试**

Create `src/app/admin/admin-copy.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("管理后台中文化", () => {
  it("登录和认证错误使用中文", () => {
    const source = [
      "src/app/admin/login/page.tsx",
      "src/app/admin/login/LoginForm.tsx",
      "src/app/admin/login/actions.ts",
    ].map(readSource).join("\n");

    expect(source).toContain("管理员登录");
    expect(source).toContain("用户名或密码不正确");
    expect(source).not.toContain("Sign in");
  });

  it("记录管理页面不再使用旧英文操作文案", () => {
    const source = [
      "src/components/AdminShell.tsx",
      "src/components/AdminRecordForm.tsx",
      "src/app/admin/(protected)/page.tsx",
      "src/app/admin/(protected)/records/page.tsx",
      "src/app/admin/(protected)/records/new/page.tsx",
      "src/app/admin/(protected)/records/[id]/edit/page.tsx",
    ].map(readSource).join("\n");

    for (const phrase of [
      "Dashboard",
      "New record",
      "Manage records",
      "Filter records",
      "Save changes",
      "Not recorded",
    ]) {
      expect(source).not.toContain(phrase);
    }
  });
});
```

- [ ] **Step 2: 运行后台文案测试并确认失败**

Run: `npm test -- src/app/admin/admin-copy.test.ts`

Expected: 2 tests FAIL，指出登录、导航、记录管理和表单仍有英文。

- [ ] **Step 3: 中文化登录和后台导航**

Use exact copy:

```text
登录页眉题 = 管理员入口
登录页标题 = 管理员登录
登录页说明 = 使用当前部署配置的单管理员账号登录。
用户名 / 密码
登录中... / 登录
登录错误 = 管理员用户名或密码不正确。
后台导航 = 管理概览 / 记录管理 / 新建记录
后台导航 aria-label = 后台导航
```

Do not change authentication or session behavior.

- [ ] **Step 4: 中文化后台概览和记录列表**

Use exact copy:

```text
管理员工作台 / 数据库管理
记录总数 / 待审核记录 / 含质量标记的记录
管理记录 / 新建记录
最近更新的记录
更新于 {zh-CN date}
编辑
记录管理 / 数据记录
关键字 / 名称、物种、DOI、作用机制...
来源类别 / 活性类别 / 证据等级 / 结构完整度 / 审核状态
起始年份 / 截止年份 / 筛选记录
当前筛选条件匹配 {count} 条记录。
标准名称 / 英文名称 / 来源物种 / 年份 / 审核状态
未记录 / 编辑记录 / 编辑
```

Render dates with `toLocaleDateString("zh-CN")`. Keep review-status data visible.

- [ ] **Step 5: 中文化新建、编辑和表单分组**

Use exact copy:

```text
记录管理 / 新建记录 / 创建记录
记录管理 / 编辑记录 / 保存修改
基本信息 / 文献信息 / 来源与制备 / 结构信息 / 生物活性 / 数据管理
```

Keep all editable fields and review status options unchanged.

- [ ] **Step 6: 运行后台文案测试与完整测试**

Run: `npm test -- src/app/admin/admin-copy.test.ts`

Expected: 2 tests PASS。

Run: `npm test`

Expected: 全部测试 PASS。

- [ ] **Step 7: 审计后台残留英文文案**

Run:

```powershell
rg -n '"[^"]*[A-Za-z][^"]*"' src/components/AdminShell.tsx src/components/AdminRecordForm.tsx src/app/admin
```

Expected: 仅保留代码标识、CSS 类名、表单 `name`、路径、类型和技术字符串；无英文按钮、标题、说明、错误或无障碍文案。

- [ ] **Step 8: 提交任务**

```bash
git add src/app/admin/admin-copy.test.ts src/components/AdminShell.tsx src/components/AdminRecordForm.tsx src/app/admin
git commit -m "feat: localize admin record management"
```

---

### Task 4: 科研科技视觉与浏览器验收

**Files:**
- Modify: `src/app/globals.css`
- Modify only if browser verification exposes a concrete defect: UI files already changed in Tasks 1-3

**Interfaces:**
- Consumes: Tasks 1-3 已完成的中文页面、表格类名 `record-table__composition` 和 `record-table__ratio`。
- Produces: 明亮、克制的科研科技视觉；桌面和手机端均无页面级横向溢出。

- [ ] **Step 1: 建立视觉验收基线**

Start the local server on an unused port:

```powershell
npm run dev -- -p 3100
```

Open `/database` at 1440×900 and 390×844 before styling. Confirm and record:

- 现有表格仍使用旧的扁平灰绿色视觉。
- `record-table__composition` 尚未限制为两行。
- 表格缺少明确的科技感焦点和行悬停层次。

- [ ] **Step 2: 重构全局颜色与基础层级**

In `src/app/globals.css`, define and use these CSS variables:

```css
:root {
  --ink: #14272d;
  --muted: #53676d;
  --line: #d5e3e1;
  --line-strong: #adc9c5;
  --surface: #ffffff;
  --surface-soft: #f0f6f5;
  --canvas: #f4f8f7;
  --teal: #08796f;
  --teal-dark: #075b55;
  --cyan: #0b8eac;
  --navy: #173f55;
  --attention: #a96700;
  color: var(--ink);
  background: var(--canvas);
  font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
}
```

Apply the variables consistently to header, headings, links, filters, buttons, tables, detail sections, dictionary, quality and admin forms. Use `border-radius` no greater than `6px`, restrained shadows only on focused tools, and no gradients.

- [ ] **Step 3: 强化导航、筛选和表格的科技感**

Implement these exact visual behaviors:

```css
.site-header {
  border-top: 3px solid var(--cyan);
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, .98);
}

.site-brand__mark {
  width: 38px;
  height: 32px;
  background: var(--teal);
  color: #fff;
}

.filters,
.admin-search {
  border: 1px solid var(--line-strong);
  border-top: 3px solid var(--cyan);
  box-shadow: 0 10px 28px rgba(20, 39, 45, .05);
}

input:focus,
select:focus,
textarea:focus,
.button:focus-visible,
a:focus-visible {
  outline: 3px solid rgba(11, 142, 172, .22);
  outline-offset: 2px;
  border-color: var(--cyan);
}

.record-table tbody tr:hover {
  background: #f2f9f8;
}

.record-table__composition {
  min-width: 240px;
  max-width: 320px;
}

.record-table__composition span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.record-table__ratio {
  color: var(--teal-dark);
  font-family: Consolas, "SFMono-Regular", monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
```

Keep the table wrapper as the only horizontal scroll owner. Set a stable table `min-width` that fits all nine columns without compressing the composition text.

- [ ] **Step 4: 验证桌面公开页面**

At 1440×900 inspect:

- `/`
- `/database`
- `/dictionary`
- `/quality`
- `/records/poly-0001`

Confirm:

- All interface labels are Chinese.
- “单糖组成”和“组成比例” are visible; `STRUCTURE` and `REVIEW` are absent from the public list.
- Hovering a composition cell exposes the complete `title` value.
- Composition text occupies at most two lines.
- Links, inputs and buttons have visible focus states.
- No text overlaps, clipped button labels or document-level horizontal overflow.

- [ ] **Step 5: 验证手机公开页面**

At 390×844 inspect `/`, `/database`, `/records/poly-0001`, `/quality` and confirm:

- `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
- The table itself can scroll horizontally.
- Header navigation wraps without overlap.
- Filter controls use one column at the narrow breakpoint.
- Long Chinese labels fit their containers.

- [ ] **Step 6: 验证后台中文流程**

Use the local test-only administrator account already configured in ignored `.env.local`:

- `/admin/login` is Chinese.
- Login succeeds.
- `/admin` and `/admin/records` are Chinese.
- New and edit forms keep all structure fields and review status.
- Submit buttons, field groups, empty values and error text are Chinese.
- Desktop and mobile layouts have no overlap or page-level horizontal overflow.

Do not expose credentials in reports, logs or committed files.

- [ ] **Step 7: 运行最终自动化验证**

Run: `npm test`

Expected: 全部测试 PASS。

Run: `npm run lint`

Expected: exit 0，无 lint errors。

Run: `npm run build`

Expected: exit 0，Next.js production build succeeds。

- [ ] **Step 8: 审查变更范围并提交**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: 仅包含本计划文件；保留但不提交既有 `next-env.d.ts` 改动。

Commit:

```bash
git add src/app/globals.css
git commit -m "style: refine scientific database interface"
```

If browser verification required a concrete UI fix outside `globals.css`, add only those directly related files to this commit and record the reason in the task report.

---

## Final Review

After all four tasks:

1. Generate a review package from the branch merge base to `HEAD`.
2. Dispatch the most capable reviewer using `superpowers:requesting-code-review`.
3. Require explicit verdicts for:
   - exact column replacement and fallback behavior;
   - Chinese public and admin interfaces;
   - preservation of structure/review data and editing;
   - no change to import/storage;
   - responsive layout and visual requirements;
   - test quality and credential safety.
4. Fix all Critical and Important findings through one fix wave, then run one scoped re-review.
5. Run fresh `npm test`, `npm run lint`, and `npm run build` before reporting completion.

## Self-Review

- Every requirement in `docs/superpowers/specs/2026-07-30-chinese-scientific-table-redesign.md` maps to Tasks 1-4.
- The display helper signatures and CSS class names are consistent across tasks.
- Structure and review fields are removed only from the public table and remain in filters, details and admin editing.
- Public/admin copy tests contain exact expected phrases and explicit old-English exclusions.
- No task changes the data model, import pipeline, runtime storage or authentication logic.
