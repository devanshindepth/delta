# Implementation Plan: Delta Hackathon MVP

## Overview

Fourteen engineering deliverables wired into a single cohesive system. The order is strict: shared infrastructure first (`getActiveGoal`, `playwright` dep), then core engines (scraper, sandbox), then API pipeline fixes, then dashboard page rewrites, then sidebar plumbing. Property-based tests accompany each module.

All UI follows the design system in `DESIGN.md` — Geist Mono, `var(--canvas)` background, ASCII bracket prefixes, `badge-*` / `proof-block` components, no shadows or gradients.

---

## Tasks

- [x] 1. Add `getActiveGoal` helper to `lib/db/queries.ts`
  - Export `getActiveGoal(userId: string): Goal | null` — queries `goals` WHERE `user_id = ?` AND `status = 'active'` ORDER BY `updated_at DESC` LIMIT 1
  - Import `Goal` from `../types` (already imported in the file)
  - This is the single dependency-breaking prerequisite for Tasks 4, 5, and 6
  - _Requirements: 3.1, 3.6, 3.7, 5.1, 6.7, 9.1_

  - [x] 1.1 Implement `getActiveGoal` in `lib/db/queries.ts`
    - Add after the existing `listGoals` function
    - Use the pattern already established by `getDashboardStats` for `getDb()` access
    - _Requirements: 3.1, 3.6, 3.7_

  - [x]* 1.2 Write unit test for `getActiveGoal`
    - Test: returns correct active goal when one exists for the user
    - Test: returns `null` when no active goal exists
    - Test: returns most-recently-updated goal when multiple active goals exist
    - _Requirements: 3.1_

- [x] 2. Add `playwright` dependency to `package.json`
  - Run `npm install playwright` to add Playwright as a dependency (required for Task 3's CDP scraper)
  - Verify `playwright` appears in `dependencies` in `package.json`
  - _Requirements: 1.1_

  - [x] 2.1 Install Playwright and verify it resolves
    - Add `playwright` to `package.json` dependencies
    - Confirm `chromium.connectOverCDP` is importable from `playwright`
    - _Requirements: 1.1_

- [x] 3. Rewrite `lib/ingestion/scraper.ts` — Bright Data CDP + self-healing
  - Full rewrite: replace the stub Bright Data block and cheerio fallback with the CDP-first architecture
  - Module-level flag `_nativeFetchDisabled: boolean` (initialized to `false`) controls the self-heal path
  - **`cdpScrape(url, wsEndpoint)`** (internal): `chromium.connectOverCDP(wsEndpoint)` → `page.goto(url, { waitUntil: 'domcontentloaded' })` → `page.evaluate()` removes `script, style, nav, footer, header, aside` then returns `document.body.innerText` → always `browser.close()` in `finally`. Whole session wrapped in `Promise.race([..., timeout(30_000)])`.
  - **`scrapeUrl(url)`** (exported): if `BRIGHT_DATA_WS_ENDPOINT` is set AND `_nativeFetchDisabled === false` → try CDP first; on CDP error `console.warn` and fall through to `nativeScrape`. If `_nativeFetchDisabled === true` → go CDP only, on success log `[self-heal] recovered via Bright Data CDP` and reset flag to `false`.
  - **`simulateBrokenScraper()`** (exported): sets `_nativeFetchDisabled = true`.
  - Preserve existing `detectSourceType` export unchanged.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 3.1 Implement `cdpScrape` internal helper
    - Import `chromium` from `playwright`
    - Implement 30-second `Promise.race` timeout; always `browser.close()` in `finally`
    - Content extraction: `page.evaluate()` removes noise tags, returns `document.body.innerText`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.2 Implement `scrapeUrl` exported function with CDP-first routing
    - Check `process.env.BRIGHT_DATA_WS_ENDPOINT`; if set, call `cdpScrape`; on error fall back to cheerio `nativeScrape`
    - When `_nativeFetchDisabled === true`, skip native path, attempt CDP, log self-heal and reset flag on success
    - When `BRIGHT_DATA_WS_ENDPOINT` is not set, execute only native path (Req 1.4)
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

  - [x]* 3.3 Write property test for Property 1 (CDP result well-formedness)
    - **Property 1: CDP scrape returns well-formed result for any URL**
    - Mock `chromium.connectOverCDP` to return fake page content for arbitrary URL strings
    - Assert `rawContent` is non-empty string, `title` is non-empty string, `scrapedAt` is valid ISO 8601
    - **Validates: Requirements 1.1, 1.2**

  - [x]* 3.4 Write property test for Property 2 (self-heal round-trip)
    - **Property 2: Self-heal round-trip restores native fetch path**
    - For any URL: call `simulateBrokenScraper()`, then successful `scrapeUrl()` via mocked CDP, then verify `_nativeFetchDisabled` is `false` and next call uses native path
    - **Validates: Requirements 1.5, 1.6**

- [x] 4. Rewrite `lib/sandbox/local-runner.ts` — Python `child_process` execution
  - Keep the existing JS/TS execution path (`new Function()`) completely untouched
  - Replace the Python stub (the `isPython` block that returns a hardcoded `ALL_TESTS_PASSED`) with real `child_process` execution
  - Add imports: `import { spawn } from 'child_process'`, `import * as os from 'os'`, `import * as fs from 'fs'`, `import * as path from 'path'`, `import * as crypto from 'crypto'`
  - **Execution flow**: write combined code to `path.join(os.tmpdir(), \`delta_\${crypto.randomUUID()}.py\`)` → `spawn('python3', [tmpFile], { timeout: 10_000 })` with `python` fallback on `ENOENT` → collect stdout/stderr → `finally: fs.unlinkSync(tmpFile)`
  - **Pass condition**: `exitCode === 0` AND `stdout.includes('ALL_TESTS_PASSED')` → `passed: true`
  - **Fail conditions**: non-zero exit OR stdout lacks `ALL_TESTS_PASSED` → `passed: false, error: stderr`
  - **Timeout**: signal `!== null && code === null` → `passed: false, error: 'Execution timed out after 10s'`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.1 Implement Python `child_process` execution in `local-runner.ts`
    - Write temp file, spawn `python3` (fall back to `python` on ENOENT), handle exit codes and signals
    - Always `fs.unlinkSync` in `finally` block
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x]* 4.2 Write property test for Property 3 (Python result mapping)
    - **Property 3: Python execution result maps correctly from stdout**
    - For any Python code producing `ALL_TESTS_PASSED` on exit 0 → `passed: true`
    - For any Python code exiting non-zero or missing `ALL_TESTS_PASSED` → `passed: false` with non-empty `error`
    - **Validates: Requirements 2.2, 2.3**

  - [x]* 4.3 Write property test for Property 4 (temp file cleanup invariant)
    - **Property 4: Temp file cleanup invariant**
    - For any Python code string (including syntax errors, infinite-loop timeout, empty string) — enumerate `os.tmpdir()` before and after `executeLocalCodeWithTests`; assert no new `.py` files remain
    - **Validates: Requirements 2.5**

- [x] 5. Checkpoint — foundation complete
  - Ensure `getActiveGoal` is exported and type-correct, `playwright` resolves, scraper CDP path compiles, Python sandbox compiles with no TypeScript errors.
  - Run `npx tsc --noEmit` and confirm zero errors before proceeding to API rewrites.

- [x] 6. Rewrite `app/api/sources/[id]/ingest/route.ts` — full 8-step pipeline
  - Full rewrite of the existing route which uses `'default-goal-id'` placeholders
  - Import `getActiveGoal` from `@/lib/db/queries`
  - Import `analyzeChange`, `computeImpact` from `@/lib/engines/change-engine`
  - Import `computeLearningDelta` from `@/lib/engines/delta-engine`
  - Import `generateChallenge` from `@/lib/engines/challenge-engine`
  - Import `saveTechnicalChange`, `saveChangeImpact`, `saveLearningDelta`, `saveChallenge`, `listCompetencyNodes` from `@/lib/db/queries`
  - **Step 1**: resolve `userId` from header; call `getActiveGoal(userId)`; return HTTP 400 if null
  - **Steps 2–9**: mark `processing` → scrape → `analyzeChange` → `saveTechnicalChange` → `computeImpact` with `activeGoal.id` → `saveChangeImpact` → `computeLearningDelta` → `saveLearningDelta` → `generateChallenge` for missing/partial deltas → `mapSourceToGraph` → mark `completed`
  - Error handler: catch-all sets `ingestion_status = 'failed'`, saves source, returns HTTP 500
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.1 Implement goal resolution and HTTP 400 guard
    - Read `userId` from `x-user-id` header; call `getActiveGoal(userId)`; return 400 if no active goal
    - _Requirements: 3.1, 3.2_

  - [x] 6.2 Implement full 8-step pipeline with error isolation
    - Mark `processing`, run all engine steps in order, mark `completed` on success
    - Wrap entire body in try/catch: on throw, mark `failed` and return HTTP 500
    - _Requirements: 3.3, 3.4, 3.5_

  - [x]* 6.3 Write property test for Property 5 (pipeline error isolation)
    - **Property 5: Pipeline error isolation**
    - For each of the 8 pipeline steps: mock that step to throw, assert source ends in `'failed'` status and response is HTTP 500
    - **Validates: Requirements 3.5**

  - [x]* 6.4 Write property test for Property 6 (goal scoping invariant)
    - **Property 6: Goal scoping invariant**
    - For any user with an active goal: run full pipeline with mocked engines, assert no produced record has `'default-goal-id'` or another user's goal id
    - **Validates: Requirements 3.1, 3.3, 3.6, 3.7**

- [x] 7. Fix `app/api/changes/route.ts` and `app/api/delta/route.ts` to use `getActiveGoal`
  - **`changes/route.ts` POST handler**: replace `listCompetencyNodes('default-goal-id')` and `computeImpact(change, nodes, 'default-goal-id', userId)` with `getActiveGoal(userId)` lookup; return HTTP 400 if no active goal
  - **`delta/route.ts` GET handler**: replace `listCompetencyNodes('default-goal-id')` with `getActiveGoal(userId)` lookup; return `{ known: [], partial: [], missing: [], total_estimated_hours: 0 }` (not an error) if no active goal
  - _Requirements: 3.6, 3.7_

  - [x] 7.1 Fix `app/api/changes/route.ts` POST handler
    - Import `getActiveGoal`; replace hardcoded goal id; add 400 guard
    - _Requirements: 3.6_

  - [x] 7.2 Fix `app/api/delta/route.ts` GET handler
    - Import `getActiveGoal`; replace hardcoded goal id; return empty delta summary when no active goal
    - _Requirements: 3.7_

- [x] 8. Fix `app/api/profile/route.ts` and `app/api/competency/route.ts` to use `getActiveGoal`
  - **`profile/route.ts`**: replace `getDashboardStats(userId, 'default-goal-id')` with `getActiveGoal(userId)` → use `activeGoal?.id || ''` (returns zero stats gracefully if no goal)
  - **`competency/route.ts`**: when no `goalId` query param is provided, resolve via `getActiveGoal(userId)?.id`; throw `"No active goal"` if both are absent
  - _Requirements: 5.1, 6.1, 9.1_

  - [x] 8.1 Fix `app/api/profile/route.ts`
    - Import `getActiveGoal`; replace `'default-goal-id'` with resolved active goal id
    - _Requirements: 5.1, 9.1_

  - [x] 8.2 Fix `app/api/competency/route.ts`
    - Add `userId` header read; fall back to `getActiveGoal(userId)` when `goalId` param absent
    - _Requirements: 6.1_

- [x] 9. Add `app/api/changes/[id]/route.ts` and `app/api/evidence/route.ts`
  - **`changes/[id]/route.ts`** (new file): `GET` handler calls `getTechnicalChange(params.id)`; returns HTTP 404 `{ success: false, error: 'Change not found' }` if null; otherwise HTTP 200 `{ success: true, data: change }`
  - **`evidence/route.ts`** (new file): `GET` handler reads `userId` from header; executes SQL join `SELECT er.*, cn.name as node_name FROM evidence_records er JOIN competency_nodes cn ON er.competency_node_id = cn.id WHERE er.user_id = ? ORDER BY er.created_at DESC LIMIT 100`; returns `{ success: true, data: records }`
  - _Requirements: 7.3, 9.1_

  - [x] 9.1 Create `app/api/changes/[id]/route.ts`
    - Import `getTechnicalChange` from `@/lib/db/queries`; implement GET with 404 guard
    - _Requirements: 7.3_

  - [x] 9.2 Create `app/api/evidence/route.ts`
    - Use `getDb()` directly for the join query; return joined records with `node_name`
    - _Requirements: 9.1_

- [x] 10. Checkpoint — API layer complete
  - Ensure all six modified/new API routes compile with `npx tsc --noEmit`
  - Verify the `app/api/changes/[id]/route.ts` already existed in the file tree (it did — confirm it is now overwritten with the new implementation)

- [x] 11. Rewrite `app/(dashboard)/goals/page.tsx` — AI Engineer seed
  - Full rewrite from the current `redirect('/history')` stub
  - `'use client'` component with state: `goals`, `loading`, `title`, `description`, `creating`, `seedingAI`, `error`
  - On mount: `GET /api/goals` → `setGoals(json.data)`
  - `createGoal(payload, setLoadingFlag)`: `POST /api/goals`, on success prepend to goals list and clear form; on error `setError(json.error)`
  - Form: title `text-input`, description `textarea`, primary submit button disabled during `creating`
  - Seed button: label `[+] seed: ai engineer →`, `button-secondary` style, disabled during `seedingAI`; calls `createGoal` with exact payload from Req 4.5
  - Goals list: each row shows title (`heading-md`), description truncated (`body-md`), status `badge-default`, `created_at` date (`caption-md`)
  - Empty state: `[-] no goals yet — create one above or seed the ai engineer path`
  - Error: inline below form in `var(--danger)`
  - Page header pattern: `[+] goals` prefix → `your goals` h1
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 11.1 Implement goals list fetch and display
    - Mount fetch, skeleton loader (3 `animate-pulse` rows), empty state, and goal rows per design system
    - _Requirements: 4.1_

  - [x] 11.2 Implement create-goal form and AI Engineer seed button
    - Shared `createGoal` helper with correct loading flags; exact AI Engineer seed payload
    - Disable both buttons independently during their respective in-flight requests
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x]* 11.3 Write property test for Property 7 (goals list completeness)
    - **Property 7: Goals list completeness**
    - For any N goals in the DB mock, the rendered list contains exactly N rows each with title, description, status, and date
    - **Validates: Requirements 4.1, 4.3**

- [x] 12. Rewrite `app/(dashboard)/page.tsx` — dashboard redesign
  - Full rewrite replacing the learn-session textarea UI (Req 5.6 explicitly forbids retaining it)
  - `'use client'` with state: `activeGoal`, `goalStats`, `heatmapEntries`, `changes`, `loadingGoal`, `loadingHeatmap`, `loadingChanges`
  - **On mount (three parallel fetches)**:
    1. `GET /api/goals` → find first with `status === 'active'`; then `GET /api/profile` for stats
    2. `GET /api/heatmap` → `setHeatmapEntries`
    3. `GET /api/changes` → take first 5 by `detected_at DESC`
  - **Goal section**: show `activeGoal.title` (`heading-md`) + stats `${provenNodes}/${totalNodes} proven` (`caption-md`); if no active goal show `[-] no active goal — set one up →` linking to `/goals`
  - **Heatmap**: 365-day grid, `grid-template-columns: repeat(53, 1fr)`, each cell 10×10px; color mapping: `proven` → `var(--success)`, `partial` → `var(--warning)`, `stale` → `var(--danger)`, `none` → `var(--surface-card)`
  - **Changes feed**: top 5 rows — title (`body-strong`), significance badge (`badge-warning` / `badge-success` / `badge-default`), technologies (`caption-md`), date; empty state `[-] no changes detected yet — ingest a source to begin`
  - Page header: `[~] dashboard` prefix → `delta` h1
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 12.1 Implement active goal display section
    - Parallel fetch, goal title + stats display, no-active-goal prompt with link
    - _Requirements: 5.1, 5.2_

  - [x] 12.2 Implement 365-day skill heatmap grid
    - Build date→level map from `heatmapEntries`; generate 365-day array; render CSS grid with correct color mapping
    - _Requirements: 5.3_

  - [x] 12.3 Implement recent changes feed
    - Render top 5 changes with correct badge variant per significance value; empty state text
    - _Requirements: 5.4, 5.5_

  - [x]* 12.4 Write property test for Property 13 (heatmap cell color fidelity)
    - **Property 13: Heatmap cell color fidelity**
    - For any set of heatmap entries, each cell's fill SHALL match the exact design token for its level
    - **Validates: Requirements 5.3**

- [x] 13. Rewrite `app/(dashboard)/skill-graph/page.tsx` — CSS-positioned competency graph
  - Full rewrite from `redirect('/')` stub
  - `'use client'` with state: `nodes`, `edges`, `activeGoal`, `loading`
  - On mount: `GET /api/goals` → find active goal → `GET /api/competency?goalId=${id}` → set nodes + edges
  - No active goal → render `[-] no active goal — set one up →` linking to `/goals`
  - **Node container**: `position: relative`, width = `max(node.position_x) + 200`, height = `max(node.position_y) + 80`
  - **Each node**: `position: absolute`, `left: node.position_x`, `top: node.position_y`, width 160px, height 56px, border color from `evidenceStatusColor(node.evidence_status)` (`proven` → `#30d158`, `partial` → `#ff9f0a`, `stale` → `#ff3b30`, `not_started` → `rgba(15,0,0,0.12)`); content: name (`body-strong`), category (`caption-md`, `var(--mute)`)
  - **SVG overlay**: `position: absolute top-0 left-0`, same dimensions, `pointer-events: none`, `z-index` behind nodes; each edge is `<line>` connecting center of source node to center of target node with `stroke="var(--hairline)" strokeWidth="1"`
  - Skeleton loader: 3 `animate-pulse` blocks while loading
  - Page header: `[*] skill graph` prefix → `skill graph` h1
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 13.1 Implement data fetch and node rendering
    - Mount fetches with active-goal guard; compute container dimensions from node positions; render positioned node divs with correct border colors
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [x] 13.2 Implement SVG edge overlay
    - Render `<svg>` behind nodes; one `<line>` per edge connecting node centers
    - _Requirements: 6.6_

  - [x]* 13.3 Write property test for Property 8 (evidence status color mapping)
    - **Property 8: Evidence status color mapping**
    - For any `CompetencyNode`, assert `evidenceStatusColor(status)` returns exactly the specified hex for each of the four `evidence_status` values
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5**

- [x] 14. Rewrite `app/(dashboard)/changes/page.tsx` and `app/(dashboard)/changes/[id]/page.tsx`
  - **`changes/page.tsx`**: full rewrite from `redirect('/')` stub — `'use client'`, fetch `GET /api/changes`, skeleton (3 rows), significance badge helper `significanceBadge(sig)`, row click → `router.push('/changes/${change.id}')`, empty state `[-] no changes detected yet`
  - **`changes/[id]/page.tsx`**: full rewrite from redirect stub — `'use client'`, fetch `GET /api/changes/${id}`, page header `[>] changes` → change title (`display-xl`) → metadata row (type badge, significance badge, technologies `caption-md`, date) → summary section → source excerpt in `proof-block`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 14.1 Implement `changes/page.tsx` list view
    - `significanceBadge` pure function; skeleton loader; empty state; row click navigation
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 14.2 Implement `changes/[id]/page.tsx` detail view
    - Fetch single change from `GET /api/changes/${id}`; render metadata row + summary + proof-block excerpt
    - _Requirements: 7.3_

  - [x]* 14.3 Write property test for Property 9 (significance badge mapping)
    - **Property 9: Significance badge mapping**
    - For all 6 significance values assert `significanceBadge` returns the correct badge class string
    - **Validates: Requirements 7.2**

- [x] 15. Rewrite `app/(dashboard)/challenges/page.tsx` and `app/(dashboard)/challenges/[id]/page.tsx`
  - **`challenges/page.tsx`**: full rewrite from `redirect('/practice')` stub — `'use client'`, mount: fetch active goal, then nodes, then challenges; filter `challenge.competency_node_id ∈ activeGoalNodeIds` client-side; render rows: title (`body-strong`) + difficulty `badge-mute` + language `badge-default` + `${estimated_minutes} min` (`caption-md`) + `open →` link to `/challenges/${id}`; empty state `[-] no challenges generated yet — ingest a source to generate challenges`
  - **`challenges/[id]/page.tsx`**: remove the redirect-to-practice stub; `'use client'`, fetch `GET /api/challenges/${id}`, display challenge description (`body-md`) + starter code in `proof-block` + `open in sandbox →` link to `/practice/${id}`
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 15.1 Implement `challenges/page.tsx` with goal-scoped filter
    - Three-step mount fetches; client-side `Set<string>` filter; rows + empty state per design system
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 15.2 Implement `challenges/[id]/page.tsx` detail view
    - Remove redirect; fetch challenge; display description and starter code proof-block; link to practice sandbox
    - _Requirements: 8.1_

  - [x]* 15.3 Write property test for Property 10 (challenge goal-scope filter)
    - **Property 10: Challenge goal-scope filter**
    - For any mix of goal-scoped and foreign-goal challenges in the mock list, assert only goal-scoped entries pass the filter
    - **Validates: Requirements 8.2**

- [x] 16. Rewrite `app/(dashboard)/progress/page.tsx`
  - Full rewrite from `redirect('/history')` stub
  - `'use client'` with state: `evidence`, `stats`, `loading`
  - On mount (parallel): `GET /api/evidence` (returns records with `node_name`) + `GET /api/profile` (returns `stats.provenNodes`, `stats.partialNodes`, `stats.staleNodes`)
  - **Summary bar**: `[+] ${stats.provenNodes} proven`, `[~] ${stats.partialNodes} partial`, `[-] ${stats.staleNodes} stale` (inline, `caption-md`, `var(--mute)`)
  - **Evidence rows**: `node_name` (`body-strong`), `evidence_type` as `badge-default`, `+${confidence_delta}` in `var(--success)`, `created_at` date (`caption-md`, `var(--stone)`)
  - Empty state: `[-] no evidence recorded yet — complete a challenge to begin`
  - Skeleton: 3 `animate-pulse` rows while loading
  - Page header: `[#] progress` prefix → `progress` h1
  - _Requirements: 9.1, 9.2, 9.3_

  - [x] 16.1 Implement progress page with evidence + stats
    - Parallel fetches; summary bar; evidence rows; empty state; skeleton loader
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 17. Update `app/(dashboard)/practice/[id]/page.tsx` — counterexample UI
  - **Re-fetch on mount**: existing `useEffect` fetches `GET /api/challenges/${id}` → `json.data?.submissions[0]` → if `status === 'failed'` and `counterexamples.length > 0`, set counterexample state
  - **`onComplete` fix**: the `handleComplete` callback currently sends `challengePayload?.starterCode` — replace with the user's actual typed code from the Monaco editor. `CodingChallengeSandbox` has `userCode` state; pass it via the `onComplete` callback signature `(challengeId, durationSec, userCode)` or read it from a ref
  - **Counterexample proof block** (rendered when `counterexamples.length > 0`):
    - `proof-block` style: `var(--surface-dark)` background, `var(--on-dark)` text, `padding: 16px`
    - Header: `$ counterexamples` in `var(--ash)`
    - For each counterexample: `input`, `your_result`, `expected`, `failure_trace`, `invariant_violated` — each label in `var(--ash)`, value in `var(--on-dark)`, separated by `1px var(--surface-dark-elevated)` bottom border
    - When `counterexamples` is empty → do NOT render the block (Req 10.4)
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 17.1 Add counterexample state and re-fetch on mount
    - Extend existing `useEffect` to parse `submissions[0]` and set counterexample state
    - _Requirements: 10.2_

  - [x] 17.2 Render counterexample proof block
    - Conditional render; all five fields per counterexample; correct design system colors
    - _Requirements: 10.1, 10.4_

  - [x] 17.3 Fix `onComplete` to pass actual user code to submit API
    - Read user's typed code from `CodingChallengeSandbox` (via callback param or ref); pass to `POST /api/challenges/[id]/submit`
    - _Requirements: 10.1_

  - [x]* 17.4 Write property test for Property 11 (counterexample persistence round-trip)
    - **Property 11: Counterexample persistence round-trip**
    - For any `CounterExample[]` of any length with arbitrary string values: `JSON.stringify` → save to SQLite TEXT → retrieve → `JSON.parse` → assert deep-equal to original
    - **Validates: Requirements 10.3**

  - [x]* 17.5 Write property test for Property 12 (counterexample UI completeness)
    - **Property 12: Counterexample UI completeness**
    - For any failed submission with N counterexamples: assert proof block contains all 5 fields × N items; for empty array assert proof block absent from DOM
    - **Validates: Requirements 10.1, 10.4**

- [x] 18. Update `app/_components/Sidebar.tsx` — add new nav links
  - Add to the `links` array (after `practice`, before `history`):
    ```typescript
    { href: "/goals", label: "goals", prefix: "[+]" },
    { href: "/skill-graph", label: "skill graph", prefix: "[*]" },
    { href: "/changes", label: "changes", prefix: "[>]" },
    { href: "/challenges", label: "challenges", prefix: "[#]" },
    { href: "/progress", label: "progress", prefix: "[^]" },
    ```
  - Note: `[>]` is already used for the `practice` link — both can coexist; the sidebar `isActive` logic handles routing correctly. If conflict is undesirable, use `[/]` for changes.
  - Existing `learn`, `understand`, `practice`, `history`, `settings` links remain unchanged
  - _Requirements: 4.1, 6.1, 7.1, 8.1, 9.1 (navigation access for all new pages)_

  - [x] 18.1 Add five new sidebar nav links
    - Insert into `links` array; verify `isActive` logic works for `/skill-graph`, `/challenges`, `/progress` prefixes
    - _Requirements: all new pages_

- [x] 19. Final checkpoint — ensure all tests pass
  - Run `npx tsc --noEmit` — zero errors required
  - All new pages: verify no redirect stubs remain in goals, skill-graph, changes, changes/[id], challenges, challenges/[id], progress
  - Ensure `app/api/changes/[id]/route.ts` exists (was already present in file tree — confirm it has the new implementation, not the old one)
  - Ensure `app/api/evidence/route.ts` is created as a new file
  - Ensure all occurrences of `'default-goal-id'` are removed from API routes (profile, competency, changes, delta, ingest)
  - Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- All UI components follow `DESIGN.md`: Geist Mono, `var(--canvas)` background, ASCII bracket prefixes, no shadows or gradients
- `getActiveGoal` (Task 1) is the critical dependency for Tasks 6, 7, 8 — do not proceed to those without it
- `playwright` (Task 2) must be installed before Task 3 compiles
- The `'use client'` directive is required on all new dashboard pages (Next.js App Router + SQLite run server-side only; pages need `fetch` on mount)
- Counterexample persistence (Req 10.3) is already correct in the DB layer — Task 17 addresses only the UI display
- The `app/api/changes/[id]/route.ts` file already existed in the file tree as a redirect stub; Task 9.1 replaces it with a real route
- Property tests (tasks marked `*`) validate universal correctness properties from the design document — they run against the actual implementation, not mocks, where possible

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "3.1", "4.1"] },
    { "id": 2, "tasks": ["3.2", "4.2", "4.3"] },
    { "id": 3, "tasks": ["3.3", "3.4", "6.1", "7.1", "7.2", "8.1", "8.2", "9.1", "9.2"] },
    { "id": 4, "tasks": ["6.2", "11.1", "11.2", "12.1", "13.1", "14.1", "15.1", "16.1", "17.1", "18.1"] },
    { "id": 5, "tasks": ["6.3", "6.4", "12.2", "12.3", "13.2", "14.2", "15.2", "17.2", "17.3"] },
    { "id": 6, "tasks": ["11.3", "12.4", "13.3", "14.3", "15.3", "17.4", "17.5"] }
  ]
}
```
