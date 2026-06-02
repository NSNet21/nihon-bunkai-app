# Restore Support Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Restore / Support Safety to Settings without touching payment backend or performance-sensitive Browse/Search paths.

**Architecture:** Use one pure helper module for support mailto/copy and a scoped Settings UI patch. Restore RPC behavior stays unchanged.

**Tech Stack:** Expo SDK 56, React Native Web, TypeScript, Vitest.

---

### Task 1: Support Helper

**Files:**

- Create: `src/lib/support-safety.ts`
- Test: `src/lib/support-safety.test.ts`

- [ ] Write tests for encoded support mailto fields.
- [ ] Write tests that safety copy separates official restore from manual local-first backup.
- [ ] Implement `buildSupportMailto`, `SUPPORT_EMAIL`, `SUPPORT_ISSUE_LABELS`, and safety copy arrays.
- [ ] Run `pnpm exec vitest run src/lib/support-safety.test.ts`.

### Task 2: Settings UI

**Files:**

- Modify: `src/app/(tabs)/settings.tsx`

- [ ] Import support helper values.
- [ ] Rename the Account refresh button copy from generic purchase update to restore/check rights language.
- [ ] Add Local Data Safety card before Privacy.
- [ ] Add Support card with mailto template.
- [ ] Keep Import / Export help as-is except for future notes in docs.

### Task 3: Verification And Commit

**Files:**

- Modify: `PRODUCT-ROADMAP.md` if status should advance.
- Modify: `.codex/co-worker-library/import-export-direction-2026-06-02.md` only if import-help follow-up needs an extra note.

- [ ] Run targeted tests.
- [ ] Run TypeScript/lint if feasible.
- [ ] Check `git -C companion-app status --short`.
- [ ] Commit companion-app changes.

