# Initial Database Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first public database version easier to correct and cite by adding DOI visibility, simplifying search controls, and auditing polysaccharide names for Chinese display where the source data supports it.

**Architecture:** Keep the current Next.js, SQLite, and single-admin architecture. Implement the smallest changes in display helpers, table/filter components, admin form wiring, and tests without changing the Excel import contract or inventing scientific data.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, SQLite, Python Excel verification scripts.

---

### Task 1: DOI Visibility

**Files:**
- Modify: `src/components/RecordTable.tsx`
- Modify: `src/lib/display.ts`
- Test: `src/components/RecordTable.test.tsx`
- Test: `src/lib/display.test.ts`

- [ ] Add a failing test that public records render a DOI column, preserve long DOI values in hover text, and show a Chinese empty state when DOI is missing.
- [ ] Implement the minimal display helper and table column.
- [ ] Run targeted tests.

### Task 2: Simplified Search

**Files:**
- Modify: `src/components/RecordFilters.tsx`
- Modify: `src/lib/search.ts`
- Test: `src/lib/search.test.ts`
- Test: `src/app/public-copy.test.ts`

- [ ] Add a failing test that the public filter UI only exposes keyword search and activity category for the first version.
- [ ] Ensure keyword search covers name, English name, species/source, activity, DOI, and monosaccharide composition text.
- [ ] Run targeted tests.

### Task 3: Chinese Polysaccharide Name Audit

**Files:**
- Modify: `src/lib/display.ts`
- Modify: `src/lib/public-data.ts`
- Test: `src/lib/display.test.ts`
- Test: `src/lib/public-data.test.ts`

- [ ] Add a failing test for deterministic Chinese display of common polysaccharide source/name terms when a reliable local mapping exists.
- [ ] Keep scientific names, DOI, journal titles, Latin species names, and uncertain names unchanged.
- [ ] Add an audit output for records that still need manual name review.

### Task 4: Verification And Review

**Files:**
- Verify: `npm test`
- Verify: `npm run lint`
- Verify: `npm run build`
- Verify: `npm run verify:import`

- [ ] Run full checks.
- [ ] Request independent code review.
- [ ] Fix Critical and Important findings.
- [ ] Summarize remaining obvious limitations.
