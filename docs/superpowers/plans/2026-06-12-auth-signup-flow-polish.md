<!-- cspell:disable -->

# Auth Signup Flow Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split signup from login so email verification feels explicit and recoverable.

**Architecture:** Keep Supabase Auth as the only signup/login integration. `/signup` calls the existing `signUpWithPassword` helper, Supabase sends confirmation through the already configured Resend SMTP, and `/login` focuses on existing-account sign-in plus unconfirmed-account recovery.

**Tech Stack:** Expo Router, React Native Web, Supabase Auth, Playwright smoke tests, Vitest helper tests.

---

### Task 1: Add Red Smoke Coverage

**Files:**
- Modify: `tools/login-polish-smoke.mjs`

- [ ] Update the smoke test so `/login` expects a signup navigation link and `/signup` expects verification copy, password requirements, local validation, and no horizontal overflow.
- [ ] Run `pnpm --config.verify-deps-before-run=false smoke:login-polish http://localhost:8097`; expect failure because `/signup` does not exist yet and `/login` still exposes signup inline.

### Task 2: Split The UI Flow

**Files:**
- Modify: `src/app/login.tsx`
- Create: `src/app/signup.tsx`

- [ ] Remove the inline signup action from `/login`.
- [ ] Add a clear `/signup` route with email/password fields, password requirements, verification explanation, resend confirmation, and a link back to `/login`.
- [ ] Keep magic link as a login-only alternative.

### Task 3: Verify

**Files:**
- Test: `src/lib/auth-email-confirmation.test.ts`
- Test: `src/lib/auth-email-actions.test.ts`
- Test: `src/lib/login-validation.test.ts`
- Test: `tools/login-polish-smoke.mjs`

- [ ] Run targeted Vitest auth/login tests.
- [ ] Run login smoke on local dev server.
- [ ] Check `git diff` before summarizing.

<!-- cspell:enable -->
