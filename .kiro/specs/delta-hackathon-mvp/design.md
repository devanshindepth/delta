# Design Document: Delta Hackathon MVP

## Overview

This document describes the implementation design for all ten requirements of the Delta Hackathon MVP. The changes fall into three coherent areas:

1. **Bright Data CDP Scraper** — replace the stub in `lib/ingestion/scraper.ts` with a real Playwright-over-CDP connection to Bright Data, plus a self-healing demo path.
2. **Goal-scoped pipeline spine** — eliminate every `'default-goal-id'` placeholder by introducing a shared `getActiveGoal(userId)` query helper, then threading it through the ingest route, changes route, and delta route.
3. **Functional dashboard pages** — replace five redirect stubs with real Client Components that read live data, and rebuild the root dashboard.

---

## Tech Stack Context

- **Next.js 16.3.1** (App Router, React 19) — all pages are Client Components (`'use client'`) because they need `fetch` on mount. Server Components are not used here to avoid hydration complexity with SQLite/Drizzle which runs server-side only.
- **TypeScript**, **SQLite / better-sqlite3**, **Groq SDK**, **TailwindCSS v4**, **Geist Mono** design system as documented in `DESIGN.md`.
- **`@brightdata/sdk` v1.2** is installed. Its Browser API (`client.browser.getConnectUrl()`) returns a CDP WebSocket URL; we pass that URL directly to **Playwright** (`chromium.connectOverCDP`). Playwright is *not* currently in `package.json` — it must be added (`npm install playwright`). This is the correct approach per the SDK README: "Connect with Playwright — `chromium.connectOverCDP(url)`."
- Auth: **better-auth**. Current API routes read `userId` from the `x-user-id` request header (set by middleware or client). For the hackathon MVP this pattern is preserved; all six API routes that need userId continue to read `request.headers.get('x-user-id') || 'user-default'`.

---

## Architecture

### Shared Helper: `getActiveGoal`

All three requirements that touch the pipeline (Req 3, 6, 7) and the profile route (Req 9) need the same query. Rather than duplicating the SQL, add a single exported function to `lib/db/queries.ts`:

```typescript
export function getActiveGoal(userId: string): Goal | null {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1"
    )
    .get(userId) as Goal | null;
}
```

This replaces the four `listCompetencyNodes('default-goal-id')` and `getDashboardStats(userId, 'default-goal-id')` calls scattered across the API routes.

---

## Requirement 1: Bright Data CDP Scraper

### File: `lib/ingestion/scraper.ts` (full rewrite)

**Decision**: Use `@brightdata/sdk`'s `client.browser.getConnectUrl()` to obtain a CDP WebSocket URL, then drive the session with Playwright's `chromium.connectOverCDP`. Playwright must be added as a dependency. The `BRIGHT_DATA_WS_ENDPOINT` env var is the override path: when set, it is used directly as the CDP URL (bypassing SDK credential lookup). When `@brightdata/sdk` is configured via `BRIGHTDATA_BROWSERAPI_USERNAME`/`BRIGHTDATA_BROWSERAPI_PASSWORD`, the SDK builds the URL; otherwise `BRIGHT_DATA_WS_ENDPOINT` is the only path.

**Why not use the SDK's `scrapeUrl`?** The requirement specifically asks for a CDP session (full DOM, JS rendering), not the SDK's proxy-based HTTP scraper. The Browser API + Playwright gives full control over DOM manipulation and content extraction.

**Module-level flag** `_nativeFetchDisabled: boolean` drives `simulateBrokenScraper`. It is reset to `false` after a successful CDP recovery.

```
scrapeUrl(url)
  │
  ├─ if BRIGHT_DATA_WS_ENDPOINT set (or bdclient configured)
  │     AND NOT _nativeFetchDisabled == false → try CDP first
  │   ├─ cdpScrape(url, wsEndpoint)     ← 30s timeout
  │   │   ├─ chromium.connectOverCDP(wsEndpoint)
  │   │   ├─ page.goto(url, { waitUntil: 'domcontentloaded' })
  │   │   ├─ page.evaluate() strips scripts/style/nav/footer/header/aside
  │   │   ├─ returns { rawContent, title, scrapedAt }
  │   │   └─ always browser.close() in finally
  │   └─ on error → console.warn + fall through to nativeScrape
  │
  └─ nativeScrape(url)     ← cheerio path (skipped if _nativeFetchDisabled)
      ├─ fetch(url)
      ├─ cheerio.load → strip noise tags → text
      └─ returns { rawContent, title, scrapedAt }

simulateBrokenScraper()  → sets _nativeFetchDisabled = true
  (next scrapeUrl call uses CDP; on success restores flag + logs [self-heal])
```

**Key implementation details:**

- `cdpScrape` wraps the whole Playwright session in `Promise.race([..., timeout(30_000)])`. The timeout path calls `browser.close()` before rejecting.
- Content cleaning: `page.evaluate()` removes `script, style, nav, footer, header, aside` elements then returns `document.body.innerText`.
- The `simulateBrokenScraper` function sets `_nativeFetchDisabled = true`. `scrapeUrl` checks this flag; when true it skips the native fetch path and attempts CDP. On a successful CDP scrape with the flag set, it logs `[self-heal] recovered via Bright Data CDP` and sets `_nativeFetchDisabled = false`.

---

## Requirement 2: Node.js child_process Python Sandbox

### File: `lib/sandbox/local-runner.ts` (modify existing)

The existing JavaScript execution path (using `new Function()`) remains untouched. The Python stub at the bottom is replaced with a real `child_process` implementation.

**Data flow for Python execution:**

```
executeLocalCodeWithTests(solutionCode, testCode, 'python')
  │
  ├─ combined = solutionCode + '\n' + testCode
  ├─ tmpFile = path.join(os.tmpdir(), `delta_${crypto.randomUUID()}.py`)
  ├─ fs.writeFileSync(tmpFile, combined, 'utf8')
  ├─ spawn('python3', [tmpFile], { timeout: 10_000 })
  │   ├─ on exit(0) + stdout includes 'ALL_TESTS_PASSED'
  │   │   └─ return { passed: true, executionOutput: stdout }
  │   ├─ on exit(0) but stdout lacks 'ALL_TESTS_PASSED'
  │   │   └─ return { passed: false, error: stderr, executionOutput: stdout+stderr }
  │   └─ on non-zero exit
  │       └─ return { passed: false, error: stderr, executionOutput: stdout+stderr }
  ├─ on ETIMEDOUT / killed
  │   └─ return { passed: false, error: 'Execution timed out after 10s' }
  └─ finally: fs.unlinkSync(tmpFile)  ← always, even on throw
```

**`python3` with `python` fallback**: Use `spawnSync` first to check if `python3` exists; fall back to `python` if it doesn't. Concretely: wrap `spawn('python3', ...)` in a try/catch on `ENOENT`, then retry with `spawn('python', ...)`.

**Timeout**: Pass `{ timeout: 10_000 }` to `child_process.spawn` options. When the process is killed by timeout, the error code is `null` and signal is `SIGTERM`. The runner detects `signal !== null && code === null` as a timeout and returns the timeout error message.

**Imports needed**: `import { spawn } from 'child_process'`, `import * as os from 'os'`, `import * as fs from 'fs'`, `import * as path from 'path'`. These are all Node.js built-ins, no new dependencies.

---

## Requirement 3: Goal-Scoped Ingest Pipeline

### File: `app/api/sources/[id]/ingest/route.ts` (full rewrite)

The current file has three bugs: `listCompetencyNodes('default-goal-id')`, no userId, no full pipeline. The rewrite implements the full 8-step pipeline.

```typescript
// Step 1: resolve user + active goal
const userId = request.headers.get('x-user-id') || 'user-default';
const activeGoal = getActiveGoal(userId);
if (!activeGoal) return HTTP 400 { success: false, error: 'No active goal found. Create a goal first.' }

// Step 2: mark processing
source.ingestion_status = 'processing';
saveSource(source);

// Step 3: scrape
const { rawContent, title, scrapedAt } = await scrapeUrl(source.url);
source.raw_content = rawContent; source.title = title; source.scraped_at = scrapedAt;

// Step 4: change engine
const change = await analyzeChange(rawContent, source.url, title);

// Step 5: persist change
saveTechnicalChange(change);

// Step 6: compute impacts
const nodes = listCompetencyNodes(activeGoal.id);
const impacts = computeImpact(change, nodes, activeGoal.id, userId);
impacts.forEach(saveChangeImpact);

// Step 7: delta engine
const deltaSummary = computeLearningDelta(userId, change.id, nodes, impacts);
const allDeltas = [...deltaSummary.missing, ...deltaSummary.partial, ...deltaSummary.known];
allDeltas.forEach(saveLearningDelta);

// Step 8: generate challenges for missing/partial deltas
for (const delta of [...deltaSummary.missing, ...deltaSummary.partial]) {
  const node = nodes.find(n => n.id === delta.competency_node_id);
  if (node) {
    const challenge = await generateChallenge(node, change);
    saveChallenge(challenge);
  }
}

// Step 9: map source to graph + complete
const matchedNodeIds = await mapSourceToGraph(rawContent, activeGoal.id, nodes);
source.mapped_competency_ids = matchedNodeIds;
source.ingestion_status = 'completed';
saveSource(source);
return HTTP 200 { success: true, data: source }
```

Error handler wraps everything: on any throw, `source.ingestion_status = 'failed'`, `saveSource(source)`, return HTTP 500.

### File: `app/api/changes/route.ts` (modify POST handler)

Replace `listCompetencyNodes('default-goal-id')` and `computeImpact(change, nodes, 'default-goal-id', userId)`:

```typescript
const activeGoal = getActiveGoal(userId);
if (!activeGoal) {
  return NextResponse.json({ success: false, error: 'No active goal found' }, { status: 400 });
}
const nodes = listCompetencyNodes(activeGoal.id);
const impacts = computeImpact(change, nodes, activeGoal.id, userId);
```

### File: `app/api/delta/route.ts` (modify GET handler)

Replace `listCompetencyNodes('default-goal-id')`:

```typescript
const activeGoal = getActiveGoal(userId);
if (!activeGoal) {
  return NextResponse.json({ success: true, data: { known: [], partial: [], missing: [], total_estimated_hours: 0 } });
}
const nodes = listCompetencyNodes(activeGoal.id);
const impacts = listChangeImpacts(userId, changeId || undefined);
const summary = computeLearningDelta(userId, changeId, nodes, impacts);
```

---

## Requirement 4: Goals Page with AI Engineer Seed

### File: `app/(dashboard)/goals/page.tsx` (full rewrite from redirect stub)

**Component**: `'use client'` — single page component. No sub-components needed.

**State**:
```typescript
const [goals, setGoals] = useState<Goal[]>([])
const [loading, setLoading] = useState(true)
const [title, setTitle] = useState('')
const [description, setDescription] = useState('')
const [creating, setCreating] = useState(false)
const [seedingAI, setSeedingAI] = useState(false)
const [error, setError] = useState<string | null>(null)
```

**On mount**: `GET /api/goals` → `setGoals(json.data)`.

**`createGoal(payload)`**: shared async function called by both form submit and seed button. Sets the appropriate loading flag (`setCreating` or `setSeedingAI`), calls `POST /api/goals`, on success prepends the returned goal to `goals`, clears the form. On error sets `setError(json.error)`.

**AI Engineer seed payload** (exact per Req 4.5):
```json
{
  "title": "AI Engineer",
  "description": "Master the full AI engineering stack: from Python fundamentals and linear algebra through classical ML, deep learning, transformer architectures, LLM fine-tuning, inference optimization, and production serving systems."
}
```

**Layout**: Follows the design system pattern from `DESIGN.md`:
- Page header: `[+] goals` prefix → `Your Goals` h1
- Form section: `title` text-input + `description` textarea + primary submit button
- Seed button: labeled `[+] seed: ai engineer →`, uses `button-secondary` style
- Goals list: section rows, each showing title (heading-md), description (body-md truncated), status badge, and `created_at` date in caption style
- Error: inline below form in `danger` color
- Empty state: `[-] no goals yet — create one above or seed the ai engineer path`

**Note on `POST /api/goals` behavior**: The existing route already calls `generateCompetencyGraph` and seeds initial challenges. No API changes needed for this requirement.

---

## Requirement 5: Dashboard Root Page Redesign

### File: `app/(dashboard)/page.tsx` (full rewrite)

Replace the current learn-session textarea UI entirely.

**State**:
```typescript
const [activeGoal, setActiveGoal] = useState<Goal | null>(null)
const [goalStats, setGoalStats] = useState<{ totalNodes: number; provenNodes: number; partialNodes: number } | null>(null)
const [heatmapEntries, setHeatmapEntries] = useState<HeatmapEntry[]>([])
const [changes, setChanges] = useState<TechnicalChange[]>([])
const [loadingGoal, setLoadingGoal] = useState(true)
const [loadingHeatmap, setLoadingHeatmap] = useState(true)
const [loadingChanges, setLoadingChanges] = useState(true)
```

**On mount**: Three parallel fetches:
1. `GET /api/goals` → find the most recent `status === 'active'` goal, then `GET /api/profile` with the goal id to get stats — or compute from node counts returned alongside goals. **Simpler path**: fetch `GET /api/goals` (returns all goals for user), filter to `status === 'active'`, pick first. Then the stats come from `GET /api/profile` which already calls `getDashboardStats`. Update `app/api/profile/route.ts` to use `getActiveGoal` instead of hardcoded `'default-goal-id'`.
2. `GET /api/heatmap` → all entries
3. `GET /api/changes` → all changes, take first 5 by `detected_at DESC`

**Heatmap rendering**:
- Build a map of `date → level` from `heatmapEntries`
- Generate array of 365 days ending today (iterate `new Date()` back 364 days)
- Render a `<div>` grid using CSS `grid-template-columns: repeat(53, 1fr)` (53 weeks × 7 days), each cell is a 10×10px square
- Color mapping per `level`: `'proven'` → `var(--success)` (#30d158), `'partial'` → `var(--warning)` (#ff9f0a), `'stale'` → `var(--danger)` (#ff3b30), `'none'` → `var(--surface-card)` (#f1eeee)
- The `HeatmapLevel` type in `lib/types.ts` already has `"proven" | "partial" | "none" | "stale"` — map exactly to those

**Changes feed**: Show top 5 by `detected_at` DESC. Each row: title (body-strong), significance badge (badge-warning for `breaking`/`deprecated`, badge-success for `new_capability`/`new_best_practice`, badge-default for `cosmetic`/`documentation`), affected technologies as comma-separated caption, `detected_at` timestamp.

**Update `app/api/profile/route.ts`**: Replace `'default-goal-id'` with `getActiveGoal(userId)`.

---

## Requirement 6: Functional Skill Graph Page

### File: `app/(dashboard)/skill-graph/page.tsx` (full rewrite from redirect stub)

**Component**: `'use client'`. No external graph library needed — pure CSS absolute positioning inside a `position: relative` container.

**State**:
```typescript
const [nodes, setNodes] = useState<CompetencyNode[]>([])
const [edges, setEdges] = useState<CompetencyEdge[]>([])
const [activeGoal, setActiveGoal] = useState<Goal | null>(null)
const [loading, setLoading] = useState(true)
```

**On mount**:
1. `GET /api/goals` → find active goal
2. `GET /api/competency?goalId=${activeGoal.id}` → `{ nodes, edges }`

**Rendering**:

Node container: `position: relative`, width = `max(position_x) + 200px`, height = `max(position_y) + 80px` (computed from node positions).

Each node: `position: absolute`, `left: node.position_x`, `top: node.position_y`, width 160px, height 56px. Border color via `evidenceStatusColor(node.evidence_status)`:
- `'proven'` → `#30d158`
- `'partial'` → `#ff9f0a`
- `'stale'` → `#ff3b30`
- `'not_started'` → `rgba(15,0,0,0.12)`

Node content: name (body-strong), category (caption-md, mute color).

SVG overlay: `position: absolute`, `top: 0`, `left: 0`, same width/height as container, `pointer-events: none`. For each edge, find `sourceNode` and `targetNode`, draw `<line x1={src.position_x+80} y1={src.position_y+28} x2={tgt.position_x+80} y2={tgt.position_y+28} stroke="var(--hairline)" strokeWidth="1" />`. Center coordinates = `position_x + width/2`, `position_y + height/2`.

The SVG is rendered as an overlay *behind* the nodes via `z-index`.

**Update `app/api/competency/route.ts`**: Add support for resolving goalId from active goal when no `goalId` param is provided:
```typescript
const resolvedGoalId = goalId || getActiveGoal(userId)?.id;
if (!resolvedGoalId) throw new Error("No active goal");
```

---

## Requirement 7: Functional Changes Page

### File: `app/(dashboard)/changes/page.tsx` (full rewrite from redirect stub)

**Component**: `'use client'`.

**State**:
```typescript
const [changes, setChanges] = useState<TechnicalChange[]>([])
const [loading, setLoading] = useState(true)
```

**On mount**: `GET /api/changes` → `setChanges(json.data)`.

**Skeleton loader**: While `loading`, render 3 `animate-pulse` divs (height 64px, `var(--surface-card)` background, `1px var(--hairline)` border).

**Badge logic** (pure function, inline):
```typescript
function significanceBadge(sig: ChangeSignificance): string {
  if (sig === 'breaking' || sig === 'deprecated') return 'badge-warning';
  if (sig === 'new_capability' || sig === 'new_best_practice') return 'badge-success';
  return 'badge-default';
}
```

**Row click**: `router.push(\`/changes/\${change.id}\`)`.

### File: `app/(dashboard)/changes/[id]/page.tsx` (full rewrite from redirect stub)

**Component**: `'use client'`. Fetches `GET /api/changes/${id}` (add this route).

**New route**: `app/api/changes/[id]/route.ts`:
```typescript
export async function GET(request, context) {
  const change = getTechnicalChange(params.id);
  if (!change) return 404;
  return NextResponse.json({ success: true, data: change });
}
```

`getTechnicalChange` already exists in `lib/db/queries.ts`.

**Page layout**: Page header (`[>] changes`) → change title (display-xl) → metadata row (type badge, significance badge, technologies, date) → summary section → source excerpt in a proof-block (`surface-dark` background).

---

## Requirement 8: Functional Challenges Page

### File: `app/(dashboard)/challenges/page.tsx` (full rewrite from redirect stub)

**Component**: `'use client'`.

**State**:
```typescript
const [challenges, setChallenges] = useState<Challenge[]>([])
const [loading, setLoading] = useState(true)
const [activeGoalNodeIds, setActiveGoalNodeIds] = useState<Set<string>>(new Set())
```

**On mount**:
1. `GET /api/goals` → find active goal id
2. `GET /api/competency?goalId=${goalId}` → extract node ids into `activeGoalNodeIds`
3. `GET /api/challenges` → filter client-side to `challenge.competency_node_id ∈ activeGoalNodeIds`

**Difficulty badge**: All three levels use `badge-mute` style (transparent fill, `var(--mute)` text, `1px var(--hairline)` border).

**Row**: title (body-strong) + difficulty badge + language badge (badge-default) + `${estimated_minutes} min` caption + `open →` link to `/challenges/${challenge.id}`.

### File: `app/(dashboard)/challenges/[id]/page.tsx` (modify redirect stub)

Remove the redirect. Load the challenge detail page by fetching `GET /api/challenges/${id}`. Display the challenge description, starter code in a proof-block, and a link to the practice sandbox at `/practice/${id}`.

---

## Requirement 9: Functional Progress Page

### File: `app/(dashboard)/progress/page.tsx` (full rewrite from redirect stub)

**Component**: `'use client'`.

**State**:
```typescript
const [evidence, setEvidence] = useState<EvidenceRecord[]>([])
const [stats, setStats] = useState<{ provenNodes: number; partialNodes: number; staleNodes: number } | null>(null)
const [loading, setLoading] = useState(true)
```

**New API route needed**: `GET /api/evidence` — returns `listEvidenceRecords(userId)`. Add `app/api/evidence/route.ts`:
```typescript
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'user-default';
  const records = listEvidenceRecords(userId);
  return NextResponse.json({ success: true, data: records });
}
```

**On mount** (parallel):
1. `GET /api/evidence` → evidence records
2. `GET /api/profile` → stats (which now uses `getActiveGoal`)

**Node name display**: `listEvidenceRecords` returns the record with `competency_node_id`. To show the node name, fetch node data alongside or do a client-side lookup. **Simpler**: Join in the API. Add an optional `includeNodeName` query param to `/api/evidence` that does a SQL join:
```sql
SELECT er.*, cn.name as node_name 
FROM evidence_records er
JOIN competency_nodes cn ON er.competency_node_id = cn.id
WHERE er.user_id = ?
ORDER BY er.created_at DESC LIMIT 100
```

Or: return the records as-is and do a second fetch for nodes of the active goal. Given MVP constraints, the join approach in the route is cleaner.

**Summary bar**: Three inline stat blocks: `[+] ${stats.provenNodes} proven`, `[~] ${stats.partialNodes} partial`, `[-] ${stats.staleNodes} stale`.

**Evidence row**: node name (body-strong), evidence type as badge-default, `+${confidence_delta}` confidence in success color, `created_at` date.

---

## Requirement 10: Counterexample Feedback Preservation

Three changes required:

### 1. `lib/engines/verification-engine.ts` — already correct

`verifySubmission` already calls `generateCounterExamples` and returns `counterexamples`. The `ChallengeSubmission` is built with `counterexamples: result.counterexamples` in `app/api/challenges/[id]/submit/route.ts`. The DB write via `saveChallengeSubmission` already does `JSON.stringify(sub.counterexamples)`. The read via `getChallengeSubmission` already does `JSON.parse(row.counterexamples || "[]")`. **No changes needed to the engine or DB layer** — the preservation is already correct.

### 2. `app/api/challenges/[id]/route.ts` — already returns submissions

`GET /api/challenges/[id]` already calls `listChallengeSubmissions(params.id, userId)` and returns `{ challenge, submissions }`. The submissions array includes parsed `counterexamples`. **No changes needed** to this route.

### 3. `app/(dashboard)/practice/[id]/page.tsx` (or new `challenges/[id]` page) — UI changes

The challenge submission UI needs two additions:

**A. Counterexample proof block** (shown when `status === 'failed'` and `counterexamples.length > 0`):
```tsx
{submission.status === 'failed' && submission.counterexamples.length > 0 && (
  <div style={{ background: 'var(--surface-dark)', color: 'var(--on-dark)', padding: '16px', marginTop: '16px' }}>
    <p style={{ color: 'var(--ash)', marginBottom: '12px' }}>$ counterexamples</p>
    {submission.counterexamples.map((ce, i) => (
      <div key={i} style={{ marginBottom: '12px', borderBottom: '1px solid var(--surface-dark-elevated)', paddingBottom: '12px' }}>
        <div><span style={{ color: 'var(--ash)' }}>input:</span> {ce.input}</div>
        <div><span style={{ color: 'var(--ash)' }}>your_result:</span> {ce.your_result}</div>
        <div><span style={{ color: 'var(--ash)' }}>expected:</span> {ce.expected}</div>
        <div><span style={{ color: 'var(--ash)' }}>failure_trace:</span> {ce.failure_trace}</div>
        <div><span style={{ color: 'var(--ash)' }}>invariant_violated:</span> {ce.invariant_violated}</div>
      </div>
    ))}
  </div>
)}
```

**B. Re-fetch on mount**: On mount, the practice page fetches `GET /api/challenges/${id}`, which returns `{ challenge, submissions }`. The most recent submission is `submissions[0]`. If `submissions[0]?.status === 'failed'`, populate the counterexample block from `submissions[0].counterexamples`.

The `onComplete` callback in `practice/[id]/page.tsx` currently sends starter code to the submit route — this needs to be updated to send the user's actual typed code from the Monaco editor. `CodingChallengeSandbox` already has `userCode` state; the `onComplete` callback needs to accept and pass it.

**`ChallengeSubmission.counterexamples` truncation**: The `saveChallengeSubmission` query uses `JSON.stringify(sub.counterexamples)` which preserves the full array. The schema column is `TEXT NOT NULL DEFAULT '[]'` — SQLite TEXT has no length limit. No truncation occurs.

---

## Components and Interfaces

### `lib/db/queries.ts` — New export

```typescript
/** Returns the most recently updated active goal for a user, or null if none exists. */
export function getActiveGoal(userId: string): Goal | null
```

### `lib/ingestion/scraper.ts` — Exported interface

```typescript
/** Scrapes a URL using CDP (when BRIGHT_DATA_WS_ENDPOINT is set) or native fetch+cheerio. */
export async function scrapeUrl(url: string): Promise<{ rawContent: string; title: string; scrapedAt: string }>

/** Temporarily disables the native fetch path to force CDP self-healing on next scrapeUrl call. */
export function simulateBrokenScraper(): void
```

Internal helper (not exported):
```typescript
async function cdpScrape(url: string, wsEndpoint: string): Promise<{ rawContent: string; title: string; scrapedAt: string }>
```

### `lib/sandbox/local-runner.ts` — Modified signature (unchanged)

```typescript
export async function executeLocalCodeWithTests(
  solutionCode: string,
  testCode: string,
  language: string   // 'python' | 'py' now handled by child_process; others unchanged
): Promise<{ executionOutput: string; testResults: TestResult[] }>
```

### `app/api/evidence/route.ts` — New route

```typescript
GET /api/evidence
  Headers: x-user-id
  Response: { success: true, data: Array<EvidenceRecord & { node_name: string }> }
```

### `app/api/changes/[id]/route.ts` — New route

```typescript
GET /api/changes/:id
  Response: { success: true, data: TechnicalChange }
            { success: false, error: string } (404 if not found)
```

### Dashboard Page Components

Each new page component follows the same interface contract:
- `'use client'` directive
- Local state for data, loading, and error
- `useEffect` on mount for API fetch(es)
- Renders loading skeletons, empty states, or data rows per requirements
- No props — all data sourced from API calls using `x-user-id` header

---

## Data Models

All data models are defined in `lib/types.ts` and the SQLite schema in `lib/db/schema.ts`. No new tables or columns are required for this MVP. The existing models used across all requirements are:

### `Goal`
```typescript
{ id, user_id, title, description, status: 'active'|'paused'|'completed', created_at, updated_at }
```
**Active goal query pattern**: `WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1`

### `CompetencyNode`
```typescript
{ id, goal_id, name, category, description, evidence_status: EvidenceStatus, confidence, last_proven_at, position_x, position_y, created_at }
```
`EvidenceStatus = 'proven' | 'partial' | 'not_started' | 'stale'`

### `CompetencyEdge`
```typescript
{ id, goal_id, source_node_id, target_node_id, relationship }
```

### `TechnicalChange`
```typescript
{ id, title, source_url, source_title, source_excerpt, change_type, significance, summary, raw_content, affected_technologies: string[], detected_at, scraped_at }
```
`affected_technologies` is stored as JSON string in SQLite, deserialized on read.

### `ChangeImpact`
```typescript
{ id, change_id, competency_node_id, goal_id, user_id, relevance_score, relevance_reason, status, created_at }
```

### `LearningDelta`
```typescript
{ id, user_id, change_id, competency_node_id, competency_name, status: DeltaStatus, required_concepts: string[], estimated_hours, created_at }
```

### `Challenge`
```typescript
{ id, competency_node_id, change_id, title, description, challenge_type, difficulty, language, starter_code, test_code, expected_output, verification_method, estimated_minutes, why_it_matters, created_at }
```

### `ChallengeSubmission`
```typescript
{ id, challenge_id, user_id, code, language, status, execution_output, test_results: TestResult[], counterexamples: CounterExample[], duration_ms, submitted_at }
```
`counterexamples` is stored as a JSON string in the `TEXT` column. SQLite TEXT has no maximum length, so arrays of any size are preserved exactly.

### `CounterExample`
```typescript
{ input: string, your_result: string, expected: string, failure_trace: string, invariant_violated: string }
```

### `EvidenceRecord`
```typescript
{ id, user_id, competency_node_id, evidence_type, details, confidence_delta, challenge_id?, source_id?, created_at }
```

### `HeatmapEntry`
```typescript
{ date: string /* YYYY-MM-DD */, competency_node_id, level: 'proven'|'partial'|'none'|'stale', evidence_count }
```

---

## Error Handling

All API routes use the existing pattern from the codebase:
```typescript
try { /* ... */ return NextResponse.json({ success: true, data: result }); }
catch (error: unknown) { return NextResponse.json({ success: false, error: toErrorMessage(error) }, { status: 500 }); }
```

Specific error cases:
- **No active goal** (ingest, changes POST): HTTP 400 `{ success: false, error: 'No active goal found. Create a goal first.' }`
- **Source not found** (ingest): HTTP 500 `{ success: false, error: 'Source not found' }`
- **Pipeline step failure** (ingest): source is marked `'failed'`, HTTP 500 with the thrown error message
- **CDP timeout** (scraper): falls back to native fetch; only throws if native fetch also fails
- **Python timeout** (sandbox): returns `{ passed: false, error: 'Execution timed out after 10s' }` without throwing

Dashboard pages handle API errors by setting an inline error state (`setError(json.error)`) and rendering the message in `var(--danger)` color beneath the relevant section. No navigation occurs on error.

---

## Testing Strategy

### Unit tests (example-based)

Target pure functions with deterministic outputs:
- `significanceBadge(sig)` — each of the six significance values maps to the correct CSS class
- `evidenceStatusColor(status)` — each of the four status values maps to the correct hex color
- `getActiveGoal(userId)` — returns correct goal from DB when active goal exists; returns null when none
- `simulateBrokenScraper()` + `scrapeUrl()` sequence — verifies the self-heal flow with mocked CDP

### Property-based tests

Target functions where input space variation reveals edge cases:
- Python sandbox: any code string producing `ALL_TESTS_PASSED` → `passed: true`; any code not producing it → `passed: false`
- Temp file cleanup: any code string leaves no `.py` files in `os.tmpdir()` after execution
- Counterexample round-trip: any `CounterExample[]` survives `JSON.stringify` → SQLite persist → `JSON.parse` unchanged
- Goal scope filter: any challenges list filtered by active goal node ids returns only matching entries
- Heatmap color: any `HeatmapLevel` value maps to its exact design token color

### Integration tests (1-3 examples)

For flows involving multiple systems or external calls:
- Full ingest pipeline with mocked scraper + mocked Groq: verifies all 8 steps write to DB and source reaches `'completed'`
- CDP path with mocked `chromium.connectOverCDP`: verifies branch taken when `BRIGHT_DATA_WS_ENDPOINT` is set

---

## Data Flow Summary

```
User action → Dashboard page → API route → lib/db/queries.ts (SQLite) / lib/engines/*.ts (Groq)
                                     ↑
                     getActiveGoal(userId) replaces 'default-goal-id' everywhere
```

### New / Modified Files

| File | Action | Requirement |
|------|--------|------------|
| `lib/db/queries.ts` | Add `getActiveGoal(userId)` | 3, 5, 6, 7, 9 |
| `lib/ingestion/scraper.ts` | Full rewrite with CDP + self-heal | 1 |
| `lib/sandbox/local-runner.ts` | Add Python child_process execution | 2 |
| `app/api/sources/[id]/ingest/route.ts` | Full pipeline wiring | 3 |
| `app/api/changes/route.ts` | Replace `default-goal-id` in POST | 3 |
| `app/api/delta/route.ts` | Replace `default-goal-id` | 3 |
| `app/api/profile/route.ts` | Replace `default-goal-id` | 5, 9 |
| `app/api/competency/route.ts` | Add fallback to active goal | 6 |
| `app/api/changes/[id]/route.ts` | New: GET single change | 7 |
| `app/api/evidence/route.ts` | New: GET evidence records with node name | 9 |
| `app/(dashboard)/page.tsx` | Full rewrite: goal + heatmap + changes | 5 |
| `app/(dashboard)/goals/page.tsx` | Full rewrite: list + form + seed button | 4 |
| `app/(dashboard)/skill-graph/page.tsx` | Full rewrite: CSS positioned graph | 6 |
| `app/(dashboard)/changes/page.tsx` | Full rewrite: changes list | 7 |
| `app/(dashboard)/changes/[id]/page.tsx` | Full rewrite: change detail | 7 |
| `app/(dashboard)/challenges/page.tsx` | Full rewrite: challenges list | 8 |
| `app/(dashboard)/challenges/[id]/page.tsx` | Rewrite: remove redirect, show detail | 8 |
| `app/(dashboard)/progress/page.tsx` | Full rewrite: evidence + stats | 9 |
| `app/(dashboard)/practice/[id]/page.tsx` | Add counterexample block + re-fetch on mount | 10 |
| `app/_components/Sidebar.tsx` | Add goals/changes/challenges/skill-graph/progress links | all |
| `package.json` | Add `playwright` dependency | 1 |

### Sidebar Updates

The current sidebar only has: learn `/`, understand `/understand`, practice `/practice`, history `/history`, settings `/settings`. For the hackathon demo the sidebar should expose the new pages. Add to `links` array in `app/_components/Sidebar.tsx`:

```typescript
{ href: "/goals", label: "goals", prefix: "[+]" },
{ href: "/skill-graph", label: "skill graph", prefix: "[*]" },
{ href: "/changes", label: "changes", prefix: "[>]" },
{ href: "/challenges", label: "challenges", prefix: "[#]" },
{ href: "/progress", label: "progress", prefix: "[^]" },
```

---

## Error Handling Patterns

All new API routes follow the existing pattern:
```typescript
try {
  // ...
  return NextResponse.json({ success: true, data: result });
} catch (error: unknown) {
  return NextResponse.json({ success: false, error: toErrorMessage(error) }, { status: 500 });
}
```

All new page components show inline error states using the design system's `danger` color (`var(--danger)`) without navigating away.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: CDP scrape returns well-formed result for any URL

*For any* URL, when `BRIGHT_DATA_WS_ENDPOINT` is set and the CDP session succeeds, `scrapeUrl` SHALL return an object with a non-empty `rawContent` string, a non-empty `title` string, and a `scrapedAt` value that is a valid ISO 8601 date string.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: Self-heal round-trip restores native fetch path

*For any* URL, after `simulateBrokenScraper()` is called followed by a successful CDP-path invocation of `scrapeUrl`, a subsequent call to `scrapeUrl` SHALL execute the native fetch path (i.e., `_nativeFetchDisabled` is `false` again).

**Validates: Requirements 1.5, 1.6**

---

### Property 3: Python execution result maps correctly from stdout

*For any* Python solution and test code whose combined execution produces stdout containing `ALL_TESTS_PASSED` and exits with code 0, `executeLocalCodeWithTests` SHALL return `testResults` with `passed: true`. Conversely, *for any* execution that exits non-zero or whose stdout does not contain `ALL_TESTS_PASSED`, it SHALL return `passed: false` with a non-empty `error` field.

**Validates: Requirements 2.2, 2.3**

---

### Property 4: Temp file cleanup invariant

*For any* Python code string (including code that throws, times out, or has syntax errors), no temporary `.py` file shall remain in `os.tmpdir()` after `executeLocalCodeWithTests` returns.

**Validates: Requirements 2.5**

---

### Property 5: Pipeline error isolation

*For any* pipeline step (scrape, analyzeChange, computeImpact, computeLearningDelta, generateChallenge) that throws an error, the source record's `ingestion_status` SHALL be `'failed'` and the HTTP response SHALL be 500.

**Validates: Requirements 3.5**

---

### Property 6: Goal scoping invariant

*For any* authenticated user with an active goal, every competency node, change impact, learning delta, and challenge produced by the ingest pipeline SHALL have a `goal_id` or `competency_node_id` that traces back to that user's active goal, and NOT to any other user's goal or to the literal string `'default-goal-id'`.

**Validates: Requirements 3.1, 3.3, 3.6, 3.7**

---

### Property 7: Goals list completeness

*For any* user with N goals stored in the database, the `/goals` page SHALL render exactly N goal rows in its list, each displaying the goal's title, description, status, and formatted creation date.

**Validates: Requirements 4.1, 4.3**

---

### Property 8: Evidence status color mapping

*For any* `CompetencyNode`, the border color applied by the skill graph renderer SHALL be exactly `#30d158` when `evidence_status === 'proven'`, `#ff9f0a` when `partial`, `#ff3b30` when `stale`, and `rgba(15,0,0,0.12)` when `not_started`. No other color SHALL be applied.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

---

### Property 9: Significance badge mapping

*For any* `TechnicalChange`, the badge class applied on the changes page SHALL be `badge-warning` when `significance ∈ {breaking, deprecated}`, `badge-success` when `significance ∈ {new_capability, new_best_practice}`, and `badge-default` when `significance ∈ {cosmetic, documentation}`.

**Validates: Requirements 7.2**

---

### Property 10: Challenge goal-scope filter

*For any* set of challenges in the database containing both goal-scoped and non-goal-scoped entries, the challenges page SHALL display only challenges whose `competency_node_id` belongs to the active goal's nodes. Challenges from other goals SHALL NOT appear.

**Validates: Requirements 8.2**

---

### Property 11: Counterexample persistence round-trip

*For any* `CounterExample[]` array of any length (including arrays with deeply nested strings, special characters, or empty strings in field values), serializing via `JSON.stringify`, persisting to SQLite TEXT column, retrieving, and deserializing via `JSON.parse` SHALL produce an array that is deep-equal to the original. No element, field, or character SHALL be truncated or mutated.

**Validates: Requirements 10.3**

---

### Property 12: Counterexample UI completeness

*For any* failed `ChallengeSubmission` where `counterexamples.length > 0`, the rendered proof block SHALL contain all five fields (`input`, `your_result`, `expected`, `failure_trace`, `invariant_violated`) for each counterexample element. When `counterexamples.length === 0`, the proof block element SHALL NOT be present in the DOM.

**Validates: Requirements 10.1, 10.4**

---

### Property 13: Heatmap cell color fidelity

*For any* set of heatmap entries, each rendered day cell's fill color SHALL correspond exactly to its `level` value: `proven` → `var(--success)`, `partial` → `var(--warning)`, `stale` → `var(--danger)`, `none` → `var(--surface-card)`.

**Validates: Requirements 5.3**
