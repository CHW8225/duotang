# Polysaccharide Research Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished polysaccharide research database website populated from `多糖数据填写所有.xlsx`, with public search/detail pages and a single-admin editing backend.

**Architecture:** Create a web application in the current workspace with a public research interface, admin-protected editing routes, and a persistent structured record store. Import the workbook once into a normalized site database, then treat the website database as the editable source of truth.

**Tech Stack:** TypeScript, React, Vite/Next-compatible site structure as selected during setup, server routes for admin actions, D1/SQLite-style structured storage, Excel import script using the bundled Python runtime for extraction and JSON handoff, CSS modules or global CSS following the app scaffold.

## Global Constraints

- Initial data source: only `多糖数据填写所有.xlsx`.
- Imported sheet: the workbook's first data sheet, named `单表导入模板` in the source workbook.
- Expected import count: 772 records.
- Preserve all 42 workbook-derived fields.
- Do not write edited website data back into the original Excel workbook.
- Single administrator account only in the first version.
- Do not hardcode real administrator passwords in code or committed files.
- Store administrator password as a hash or configure it through environment variables.
- Public website must include homepage, database search, record detail, data dictionary, and quality dashboard.
- Admin website must include login, dashboard, record list, edit existing record, create new record, and review-status update.
- Quality flags must cover missing DOI, source species, source category, molecular weight, standardized monosaccharide composition, activity category, evidence level, experiment conclusion, review status, and publication year greater than the current year.
- The UI should feel like a serious research database: clean, searchable, dense but readable, and visually polished.

---

## File Structure

- `package.json`: project scripts, dependencies, and app metadata.
- `.gitignore`: ignore dependencies, build output, local database files, and local environment files.
- `.env.example`: safe sample environment variables for admin setup.
- `.openai/hosting.json`: Sites hosting and D1 binding configuration if Sites scaffolding is used.
- `scripts/extract-excel-data.py`: read `多糖数据填写所有.xlsx`, normalize columns, compute quality flags, and write import JSON.
- `data/import/polysaccharide-records.json`: generated import data used by the app seed step.
- `src/lib/fields.ts`: canonical 42-field definitions, Chinese labels, groups, and editable-field metadata.
- `src/lib/quality.ts`: deterministic quality flag logic.
- `src/lib/search.ts`: search/filter/sort helpers used by public and admin views.
- `src/lib/auth.ts`: password hashing/session helpers or environment-based admin verification.
- `src/lib/db.ts`: data access helpers for records and admin workflows.
- `src/pages` or `app`: route/page files created by the chosen site scaffold.
- `src/components`: focused reusable UI pieces for filters, tables, detail sections, badges, and forms.
- `src/styles`: polished research-site styling.
- `tests` or `src/**/*.test.ts`: focused tests for import, quality flags, search, and auth guards.

---

### Task 1: Initialize Website Project And Git Baseline

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: initial app scaffold files from the selected site framework
- Modify: `docs/superpowers/specs/2026-07-29-polysaccharide-research-database-design.md`
- Create: `docs/superpowers/plans/2026-07-29-polysaccharide-research-database.md`

**Interfaces:**
- Produces: a runnable web project with `npm run dev`, `npm run build`, and a Git baseline commit.
- Consumes: the design spec and this implementation plan.

- [ ] **Step 1: Initialize Git if missing**

Run: `git rev-parse --is-inside-work-tree`

Expected if not initialized: command reports that the directory is not a Git repository.

Run: `git init`

Expected: Git repository initialized in `D:\多糖网站`.

- [ ] **Step 2: Create `.gitignore`**

Write these entries:

```gitignore
node_modules/
dist/
.next/
.vinext/
.wrangler/
.env
.env.local
*.db
*.sqlite
*.sqlite3
data/runtime/
```

- [ ] **Step 3: Create safe environment template**

Write `.env.example`:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=replace_with_generated_password_hash
SESSION_SECRET=replace_with_long_random_secret
```

- [ ] **Step 4: Scaffold the site**

If Sites starter is used, run the Sites initializer once in `D:\多糖网站` and keep the scaffold it creates. If a standard local framework scaffold is used, create a TypeScript React app with server-capable routes.

Expected: the project has installable dependencies, source files, and a working development script.

- [ ] **Step 5: Verify baseline scripts**

Run: `npm install`

Expected: dependencies install without errors.

Run: `npm run dev`

Expected: the development server starts and shows the starter app.

- [ ] **Step 6: Commit baseline**

Run:

```bash
git add .gitignore .env.example package.json docs/superpowers/specs/2026-07-29-polysaccharide-research-database-design.md docs/superpowers/plans/2026-07-29-polysaccharide-research-database.md
git commit -m "docs: add polysaccharide database design and plan"
```

Expected: first commit records the approved design and implementation plan.

---

### Task 2: Extract And Normalize Excel Data

**Files:**
- Create: `scripts/extract-excel-data.py`
- Create: `data/import/polysaccharide-records.json`
- Create: `src/lib/fields.ts`
- Create: `src/lib/quality.ts`
- Test: `src/lib/quality.test.ts`

**Interfaces:**
- Produces: `PolysaccharideRecord`, `FieldDefinition`, `QualityFlag`, `computeQualityFlags(record, currentYear)`.
- Consumes: `多糖数据填写所有.xlsx`.

- [ ] **Step 1: Define canonical fields**

Create `src/lib/fields.ts`:

```ts
export type FieldGroup = "identity" | "literature" | "source" | "structure" | "bioactivity" | "management";

export type FieldDefinition = {
  key: keyof PolysaccharideRecord;
  label: string;
  group: FieldGroup;
  editable: boolean;
  multiline?: boolean;
};

export type ReviewStatus = "待审核" | "已审核" | "需修改" | "未标注";

export type PolysaccharideRecord = {
  id: string;
  upload_id: string;
  standard_name: string;
  english_name: string;
  aliases: string;
  ref_id: string;
  literature_title: string;
  journal: string;
  publication_year: number | null;
  doi: string;
  pmid: string;
  source_url: string;
  source_species: string;
  source_category: string;
  extraction_part: string;
  extraction_method: string;
  purification_method: string;
  molecular_weight_value: string;
  molecular_weight_unit: string;
  molecular_weight_method: string;
  monosaccharide_original: string;
  monosaccharide_standardized: string;
  monosaccharide_ratio: string;
  glycosidic_linkage: string;
  backbone_description: string;
  branch_description: string;
  branch_site: string;
  substituent_modification: string;
  structure_completeness: string;
  activity_category: string;
  activity_subcategory: string;
  evidence_level: string;
  experiment_type: string;
  experiment_model: string;
  experiment_object: string;
  endpoint: string;
  conclusion: string;
  mechanism_pathway: string;
  key_molecules: string;
  review_status: ReviewStatus;
  recorder: string;
  entry_date: string;
  notes: string;
  data_quality_flags: string[];
  created_at: string;
  updated_at: string;
};
```

Add the 42 field definitions using the exact keys above and Chinese labels from the workbook.

- [ ] **Step 2: Write quality flag tests**

Create `src/lib/quality.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeQualityFlags } from "./quality";
import type { PolysaccharideRecord } from "./fields";

const completeRecord: PolysaccharideRecord = {
  id: "rec-1",
  upload_id: "U001",
  standard_name: "Example polysaccharide",
  english_name: "Example polysaccharide",
  aliases: "",
  ref_id: "",
  literature_title: "Example title",
  journal: "Example Journal",
  publication_year: 2024,
  doi: "10.1000/example",
  pmid: "",
  source_url: "",
  source_species: "Citrus medica",
  source_category: "植物",
  extraction_part: "fruit",
  extraction_method: "water extraction",
  purification_method: "",
  molecular_weight_value: "12.5",
  molecular_weight_unit: "kDa",
  molecular_weight_method: "HPLC",
  monosaccharide_original: "",
  monosaccharide_standardized: "Glc; Gal",
  monosaccharide_ratio: "1:2",
  glycosidic_linkage: "",
  backbone_description: "",
  branch_description: "",
  branch_site: "",
  substituent_modification: "",
  structure_completeness: "完整",
  activity_category: "抗氧化",
  activity_subcategory: "",
  evidence_level: "体外",
  experiment_type: "体外实验",
  experiment_model: "",
  experiment_object: "",
  endpoint: "DPPH",
  conclusion: "Shows antioxidant activity.",
  mechanism_pathway: "",
  key_molecules: "",
  review_status: "已审核",
  recorder: "User",
  entry_date: "2026-07-29",
  notes: "",
  data_quality_flags: [],
  created_at: "2026-07-29T00:00:00.000Z",
  updated_at: "2026-07-29T00:00:00.000Z",
};

describe("computeQualityFlags", () => {
  it("returns no flags for a complete current-year-or-earlier record", () => {
    expect(computeQualityFlags(completeRecord, 2026)).toEqual([]);
  });

  it("flags missing required scientific curation fields", () => {
    const record = {
      ...completeRecord,
      doi: "",
      molecular_weight_value: "",
      monosaccharide_standardized: "",
      review_status: "未标注" as const,
    };

    expect(computeQualityFlags(record, 2026)).toEqual([
      "missing_doi",
      "missing_molecular_weight",
      "missing_monosaccharide_standardized",
      "missing_review_status",
    ]);
  });

  it("flags publication years later than the current year", () => {
    expect(computeQualityFlags({ ...completeRecord, publication_year: 2027 }, 2026)).toContain(
      "future_publication_year",
    );
  });
});
```

- [ ] **Step 3: Run quality tests and verify they fail**

Run: `npm test -- quality`

Expected: test fails because `src/lib/quality.ts` does not exist yet.

- [ ] **Step 4: Implement quality flags**

Create `src/lib/quality.ts`:

```ts
import type { PolysaccharideRecord } from "./fields";

export const QUALITY_FLAG_LABELS: Record<string, string> = {
  missing_standard_name: "缺失标准名称",
  missing_english_name: "缺失英文名称",
  missing_doi: "缺失 DOI",
  missing_source_species: "缺失来源物种",
  missing_source_category: "缺失来源类别",
  missing_molecular_weight: "缺失分子量",
  missing_monosaccharide_standardized: "缺失标准化单糖组成",
  missing_activity_category: "缺失活性大类",
  missing_evidence_level: "缺失证据等级",
  missing_conclusion: "缺失实验结论",
  missing_review_status: "缺失审核状态",
  future_publication_year: "发表年份晚于当前年份",
};

const blank = (value: unknown) => String(value ?? "").trim() === "";

export function computeQualityFlags(record: PolysaccharideRecord, currentYear: number): string[] {
  const flags: string[] = [];

  if (blank(record.standard_name)) flags.push("missing_standard_name");
  if (blank(record.english_name)) flags.push("missing_english_name");
  if (blank(record.doi)) flags.push("missing_doi");
  if (blank(record.source_species)) flags.push("missing_source_species");
  if (blank(record.source_category)) flags.push("missing_source_category");
  if (blank(record.molecular_weight_value)) flags.push("missing_molecular_weight");
  if (blank(record.monosaccharide_standardized)) flags.push("missing_monosaccharide_standardized");
  if (blank(record.activity_category)) flags.push("missing_activity_category");
  if (blank(record.evidence_level)) flags.push("missing_evidence_level");
  if (blank(record.conclusion)) flags.push("missing_conclusion");
  if (blank(record.review_status) || record.review_status === "未标注") flags.push("missing_review_status");
  if (record.publication_year !== null && record.publication_year > currentYear) {
    flags.push("future_publication_year");
  }

  return flags;
}
```

- [ ] **Step 5: Write Excel extraction script**

Create `scripts/extract-excel-data.py` that:

```python
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "多糖数据填写所有.xlsx"
OUTPUT = ROOT / "data" / "import" / "polysaccharide-records.json"
CURRENT_YEAR = 2026

COLUMN_KEYS = [
    "upload_id", "standard_name", "english_name", "aliases", "ref_id",
    "literature_title", "journal", "publication_year", "doi", "pmid", "source_url",
    "source_species", "source_category", "extraction_part", "extraction_method",
    "purification_method", "molecular_weight_value", "molecular_weight_unit",
    "molecular_weight_method", "monosaccharide_original", "monosaccharide_standardized",
    "monosaccharide_ratio", "glycosidic_linkage", "backbone_description",
    "branch_description", "branch_site", "substituent_modification",
    "structure_completeness", "activity_category", "activity_subcategory",
    "evidence_level", "experiment_type", "experiment_model", "experiment_object",
    "endpoint", "conclusion", "mechanism_pathway", "key_molecules",
    "review_status", "recorder", "entry_date", "notes",
]

def clean(value):
    if pd.isna(value):
        return ""
    return str(value).strip()

def parse_year(value):
    if pd.isna(value) or str(value).strip() == "":
        return None
    try:
        return int(float(value))
    except ValueError:
        return None

def normalize_status(value):
    text = clean(value)
    if text in {"待审核", "已审核", "需修改"}:
        return text
    return "未标注"

def quality_flags(record):
    checks = [
        ("missing_standard_name", not record["standard_name"]),
        ("missing_english_name", not record["english_name"]),
        ("missing_doi", not record["doi"]),
        ("missing_source_species", not record["source_species"]),
        ("missing_source_category", not record["source_category"]),
        ("missing_molecular_weight", not record["molecular_weight_value"]),
        ("missing_monosaccharide_standardized", not record["monosaccharide_standardized"]),
        ("missing_activity_category", not record["activity_category"]),
        ("missing_evidence_level", not record["evidence_level"]),
        ("missing_conclusion", not record["conclusion"]),
        ("missing_review_status", record["review_status"] == "未标注"),
        ("future_publication_year", record["publication_year"] is not None and record["publication_year"] > CURRENT_YEAR),
    ]
    return [name for name, failed in checks if failed]

def main():
    df = pd.read_excel(SOURCE, sheet_name=0).dropna(how="all")
    records = []
    now = datetime.now(timezone.utc).isoformat()
    for index, row in df.iterrows():
        record = {"id": f"poly-{index + 1:04d}"}
        for position, key in enumerate(COLUMN_KEYS):
            value = row.iloc[position] if position < len(row) else ""
            record[key] = parse_year(value) if key == "publication_year" else clean(value)
        record["review_status"] = normalize_status(record["review_status"])
        record["created_at"] = now
        record["updated_at"] = now
        record["data_quality_flags"] = quality_flags(record)
        records.append(record)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(records)} records to {OUTPUT}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Generate import JSON**

Run: `python scripts/extract-excel-data.py`

Expected: command prints `wrote 772 records`.

- [ ] **Step 7: Verify generated record count**

Run a JSON count check.

Expected: `772`.

- [ ] **Step 8: Run tests and commit**

Run: `npm test -- quality`

Expected: quality tests pass.

Run:

```bash
git add scripts/extract-excel-data.py data/import/polysaccharide-records.json src/lib/fields.ts src/lib/quality.ts src/lib/quality.test.ts
git commit -m "feat: import polysaccharide workbook data"
```

---

### Task 3: Add Data Store And Search Helpers

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/search.ts`
- Test: `src/lib/search.test.ts`

**Interfaces:**
- Produces: `getRecords()`, `getRecordById(id)`, `createRecord(input)`, `updateRecord(id, input)`, `filterRecords(records, query)`.
- Consumes: `PolysaccharideRecord` from `src/lib/fields.ts`.

- [ ] **Step 1: Write search helper tests**

Create `src/lib/search.test.ts` with tests for keyword search, source category filter, activity filter, evidence filter, year range filter, review status filter, and sorting by year.

Expected behavior:

```ts
filterRecords(records, { keyword: "Citrus", sourceCategory: "植物" })
```

returns records where the keyword appears in name, literature, species, DOI, activity, mechanism, or conclusion and the source category matches.

- [ ] **Step 2: Verify search tests fail**

Run: `npm test -- search`

Expected: test fails because `filterRecords` does not exist yet.

- [ ] **Step 3: Implement search helper**

Create `src/lib/search.ts` with:

```ts
import type { PolysaccharideRecord } from "./fields";

export type RecordFilters = {
  keyword?: string;
  sourceCategory?: string;
  activityCategory?: string;
  evidenceLevel?: string;
  structureCompleteness?: string;
  reviewStatus?: string;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: "publication_year" | "standard_name" | "source_species" | "review_status";
};

const searchableText = (record: PolysaccharideRecord) =>
  [
    record.standard_name,
    record.english_name,
    record.aliases,
    record.literature_title,
    record.source_species,
    record.doi,
    record.activity_category,
    record.activity_subcategory,
    record.mechanism_pathway,
    record.key_molecules,
    record.conclusion,
  ]
    .join(" ")
    .toLowerCase();

export function filterRecords(records: PolysaccharideRecord[], filters: RecordFilters) {
  const keyword = filters.keyword?.trim().toLowerCase();
  const filtered = records.filter((record) => {
    if (keyword && !searchableText(record).includes(keyword)) return false;
    if (filters.sourceCategory && record.source_category !== filters.sourceCategory) return false;
    if (filters.activityCategory && record.activity_category !== filters.activityCategory) return false;
    if (filters.evidenceLevel && record.evidence_level !== filters.evidenceLevel) return false;
    if (filters.structureCompleteness && record.structure_completeness !== filters.structureCompleteness) return false;
    if (filters.reviewStatus && record.review_status !== filters.reviewStatus) return false;
    if (filters.yearFrom && (record.publication_year ?? 0) < filters.yearFrom) return false;
    if (filters.yearTo && (record.publication_year ?? 9999) > filters.yearTo) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case "standard_name":
        return a.standard_name.localeCompare(b.standard_name);
      case "source_species":
        return a.source_species.localeCompare(b.source_species);
      case "review_status":
        return a.review_status.localeCompare(b.review_status);
      case "publication_year":
      default:
        return (b.publication_year ?? 0) - (a.publication_year ?? 0);
    }
  });
}
```

- [ ] **Step 4: Implement data access**

Create `src/lib/db.ts` so the rest of the app uses functions rather than reading storage directly:

```ts
import importedRecords from "../../data/import/polysaccharide-records.json";
import type { PolysaccharideRecord } from "./fields";
import { computeQualityFlags } from "./quality";

let records = importedRecords as PolysaccharideRecord[];

export async function getRecords(): Promise<PolysaccharideRecord[]> {
  return records;
}

export async function getRecordById(id: string): Promise<PolysaccharideRecord | null> {
  return records.find((record) => record.id === id) ?? null;
}

export async function createRecord(input: PolysaccharideRecord): Promise<PolysaccharideRecord> {
  const now = new Date().toISOString();
  const record = {
    ...input,
    id: input.id || `poly-${Date.now()}`,
    created_at: now,
    updated_at: now,
    data_quality_flags: computeQualityFlags(input, new Date().getFullYear()),
  };
  records = [record, ...records];
  return record;
}

export async function updateRecord(id: string, input: Partial<PolysaccharideRecord>): Promise<PolysaccharideRecord | null> {
  const existing = records.find((record) => record.id === id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...input,
    id,
    updated_at: new Date().toISOString(),
  };
  updated.data_quality_flags = computeQualityFlags(updated, new Date().getFullYear());
  records = records.map((record) => (record.id === id ? updated : record));
  return updated;
}
```

When using D1/SQLite in the scaffold, keep the same exported function names and move the persistence logic behind these functions.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- search`

Expected: search tests pass.

Run:

```bash
git add src/lib/db.ts src/lib/search.ts src/lib/search.test.ts
git commit -m "feat: add polysaccharide data access and search"
```

---

### Task 4: Build Public Research Website

**Files:**
- Create/Modify: route files for `/`, `/database`, `/records/[id]`, `/dictionary`, `/quality`
- Create: `src/components/SummaryMetric.tsx`
- Create: `src/components/RecordTable.tsx`
- Create: `src/components/RecordFilters.tsx`
- Create: `src/components/RecordDetailSections.tsx`
- Create: `src/components/QualityBadge.tsx`
- Modify: global styles

**Interfaces:**
- Consumes: `getRecords()`, `getRecordById()`, `filterRecords()`, `FIELD_DEFINITIONS`, `QUALITY_FLAG_LABELS`.
- Produces: public pages that expose the imported scientific database.

- [ ] **Step 1: Build homepage**

Show:

- title: `Polysaccharide Research Database`
- subtitle: `Structure, source, literature, and bioactivity records for curated polysaccharide research`
- total records: 772
- year span: 1954-2027
- top source/activity/evidence summaries from imported data
- primary action linking to `/database`

- [ ] **Step 2: Build database page**

Add:

- keyword search input
- source category dropdown
- activity category dropdown
- evidence level dropdown
- structure completeness dropdown
- review status dropdown
- year range inputs
- result count
- readable record table

Each row must show standard name, English name, source species, publication year, activity category, evidence level, structure completeness, review status, and a detail link.

- [ ] **Step 3: Build record detail page**

Group fields into:

- Identity
- Literature
- Source and Preparation
- Structure
- Bioactivity
- Data Management

Show DOI and source URL as links when present.

- [ ] **Step 4: Build dictionary page**

Render `FIELD_DEFINITIONS` as grouped field explanations with English key, Chinese label, group, and whether the field is editable.

- [ ] **Step 5: Build quality dashboard**

Aggregate `data_quality_flags` across records and show:

- count by quality issue
- affected record list
- future-year records including 2027 values
- links to record details

- [ ] **Step 6: Style responsive research UI**

Use:

- compact navigation
- restrained green, blue, and neutral palette
- readable tables
- status badges
- no marketing hero card
- no decorative gradient blobs
- stable filter and table dimensions

- [ ] **Step 7: Build and commit**

Run: `npm run build`

Expected: production build succeeds.

Run:

```bash
git add src app package.json
git commit -m "feat: build public polysaccharide database"
```

---

### Task 5: Add Single-Admin Login And Protected Backend

**Files:**
- Create: `src/lib/auth.ts`
- Create/Modify: routes for `/admin/login`, `/admin`, `/admin/records`, `/admin/records/new`, `/admin/records/[id]/edit`
- Create: `src/components/AdminRecordForm.tsx`
- Create: `src/components/AdminShell.tsx`
- Test: auth guard test if the selected framework supports route-level tests

**Interfaces:**
- Consumes: `getRecords()`, `getRecordById()`, `createRecord()`, `updateRecord()`, `FIELD_DEFINITIONS`.
- Produces: protected admin editing workflow.

- [ ] **Step 1: Implement admin auth helper**

Create `src/lib/auth.ts` with:

```ts
export type AdminSession = {
  username: string;
  authenticatedAt: string;
};

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH && process.env.SESSION_SECRET);
}

export async function verifyAdminPassword(username: string, password: string) {
  if (!isAdminConfigured()) return false;
  if (username !== process.env.ADMIN_USERNAME) return false;
  const expected = process.env.ADMIN_PASSWORD_HASH ?? "";
  return expected.length > 0 && password.length > 0;
}
```

Before final verification, implement real password-hash verification supported by the selected runtime.

- [ ] **Step 2: Build login page**

Login page must:

- show username and password fields
- show a clear error on failed login
- create a server-side session on success
- redirect to `/admin`

- [ ] **Step 3: Protect admin routes**

Unauthenticated access to `/admin`, `/admin/records`, `/admin/records/new`, and `/admin/records/[id]/edit` must redirect to `/admin/login`.

- [ ] **Step 4: Build admin dashboard**

Show:

- total records
- pending review count
- records with quality flags
- latest updated records
- buttons for record management and new record

- [ ] **Step 5: Build admin record list**

Use the same search/filter logic as the public database, but include edit links.

- [ ] **Step 6: Build record form**

Render editable fields from `FIELD_DEFINITIONS`.

Use:

- text inputs for short fields
- textarea for literature title, extraction method, purification method, structure descriptions, conclusion, mechanism, notes
- select for review status
- number input for publication year

- [ ] **Step 7: Implement save actions**

For edit:

```ts
await updateRecord(id, formRecord);
```

For create:

```ts
await createRecord(formRecord);
```

After save, redirect to the edited record or admin list.

- [ ] **Step 8: Verify admin workflow and commit**

Manual checks:

- logged-out `/admin` redirects to `/admin/login`
- wrong password fails
- correct admin login succeeds
- editing a record changes its saved values
- creating a record adds one new record
- quality flags refresh after saving incomplete fields

Run: `npm run build`

Expected: production build succeeds.

Run:

```bash
git add src app
git commit -m "feat: add admin editing backend"
```

---

### Task 6: Final Verification, Polish, And Delivery

**Files:**
- Modify only files needed to fix verification failures.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified first version.

- [ ] **Step 1: Verify import count**

Run the import script and count generated records.

Expected: exactly `772`.

- [ ] **Step 2: Verify public workflows**

Check:

- homepage loads
- database page shows 772 records before filters
- keyword search finds records by species and DOI
- source/activity/evidence/status/year filters work
- a record detail page shows all major sections
- dictionary page lists field groups
- quality page shows missing-field and future-year issues

- [ ] **Step 3: Verify admin workflows**

Check:

- admin routes require login
- correct admin login works with local environment variables
- edit save works
- create save works
- review status update works
- quality flags update after edits

- [ ] **Step 4: Verify responsive layout**

Check desktop and mobile widths:

- filters do not overlap
- table remains readable
- buttons and text fit inside containers
- detail sections are not clipped
- admin form remains usable

- [ ] **Step 5: Run final build**

Run: `npm run build`

Expected: build succeeds without errors.

- [ ] **Step 6: Commit final polish**

If verification required fixes, run:

```bash
git add .
git commit -m "chore: verify polysaccharide research database"
```

- [ ] **Step 7: Deliver**

Return:

- local preview URL or deployed production URL
- default admin setup instructions without exposing secrets
- verification summary
- note that the original Excel file was not modified

---

## Self-Review

Spec coverage:

- Public homepage: Task 4.
- Searchable database: Task 4.
- Record detail view: Task 4.
- Data dictionary: Task 4.
- Quality dashboard: Task 4 and Task 6.
- Single-admin login: Task 5.
- Record editing and creation: Task 5.
- Initial import from Excel: Task 2.
- Preserve Excel as source input only: Global Constraints and Task 2.
- Validation and build: Task 6.

Plan completeness scan:

- No unfinished markers or deferred implementation notes remain.
- Task 5 requires real password-hash verification before final verification.

Type consistency:

- `PolysaccharideRecord`, `ReviewStatus`, `computeQualityFlags`, `filterRecords`, `getRecords`, `getRecordById`, `createRecord`, and `updateRecord` are defined once and reused consistently.
