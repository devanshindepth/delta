# Requirements Document

## Introduction

Delta Hackathon MVP is a set of targeted engineering deliverables that must be demo-ready by August 23, 2026. The work spans three equally weighted areas: (1) replacing the stub scraper in `lib/ingestion/scraper.ts` with a real Bright Data Scraping Browser (CDP) implementation including a self-healing fallback, (2) wiring the full source-ingest → change-engine → delta-engine → challenge-engine → verification-engine pipeline so every API endpoint operates on real goal-scoped data rather than the `default-goal-id` placeholder, and (3) converting all redirecting dashboard pages (`/skill-graph`, `/changes`, `/challenges`, `/progress`, `/goals`) into functional views that display real data from the database, with the root dashboard (`/`) rebuilt to show goal display, skill heatmap, and a recent-changes feed.

## Glossary

- **Scraper**: The module at `lib/ingestion/scraper.ts` responsible for fetching remote content and returning `rawContent`, `title`, and `scrapedAt`.
- **Bright Data**: The third-party scraping infrastructure accessed via a Scraping Browser (CDP) WebSocket endpoint. Credentials are read from `BRIGHT_DATA_WS_ENDPOINT` in the environment.
- **CDP Session**: A Chrome DevTools Protocol WebSocket connection to the Bright Data Scraping Browser that enables JavaScript rendering of target pages.
- **Self-Healing Demo**: A deliberate simulation of a scraper failure that is automatically recovered by switching from the native-fetch path to the Bright Data CDP path.
- **Ingest Pipeline**: The ordered sequence: Scraper → Change Engine → Delta Engine → Challenge Engine persisted to SQLite via `lib/db/queries.ts`.
- **Pipeline Spine**: The route `POST /api/sources/[id]/ingest` which orchestrates the full Ingest Pipeline for a single Source record.
- **Goal**: A user-defined learning objective stored in the `goals` table; the primary key for scoping competency nodes, changes, and deltas.
- **Active Goal**: The single `goals` record for the authenticated user that has `status = 'active'` and was most recently updated.
- **Competency Node**: A vertex in the goal's competency graph stored in `competency_nodes`, identified by `goal_id`.
- **Change Engine**: `lib/engines/change-engine.ts` — extracts a `TechnicalChange` from raw scraped content.
- **Delta Engine**: `lib/engines/delta-engine.ts` — computes `LearningDelta` records from change impacts against the user's competency nodes.
- **Challenge Engine**: `lib/engines/challenge-engine.ts` — generates executable `Challenge` records for competency nodes.
- **Verification Engine**: `lib/engines/verification-engine.ts` — executes submitted code in the local sandbox and produces counterexamples on failure.
- **Local Sandbox**: `lib/sandbox/local-runner.ts` — executes JavaScript/TypeScript via Node.js `child_process` and Python via a spawned interpreter.
- **Skill Heatmap**: A calendar-style visualization of competency evidence activity over the past 365 days, sourced from `heatmap_entries`.
- **AI Engineer Seed**: A one-click button on the `/goals` page that creates a pre-defined "AI Engineer" goal without requiring the user to type a description.
- **Counterexample Feedback**: The `counterexamples` array returned by the Verification Engine and stored on `challenge_submissions`, preserved across UI renders.
- **Dashboard**: The root route `/` of the `(dashboard)` layout group.

---

## Requirements

### Requirement 1: Bright Data CDP Scraper Implementation

**User Story:** As a developer running the hackathon demo, I want the scraper to use a real Bright Data Scraping Browser session so that JavaScript-rendered pages like the DeepSeek API changelog and PyTorch blog are fetched with full DOM content rather than empty shells.

#### Acceptance Criteria

1. WHEN `scrapeUrl` is called and `process.env.BRIGHT_DATA_WS_ENDPOINT` is set, THE Scraper SHALL open a CDP WebSocket connection to the Bright Data Scraping Browser endpoint, navigate to the target URL, wait for the DOM to be interactive, and extract the page title and body text.
2. WHEN the CDP session successfully returns page content, THE Scraper SHALL close the CDP session and return `{ rawContent, title, scrapedAt }` where `rawContent` is the visible text content of the rendered DOM with scripts, styles, nav, footer, header, and aside elements removed.
3. IF the CDP session throws an error or times out after 30 seconds, THEN THE Scraper SHALL log a warning to `console.warn`, close any open CDP session, and fall back to the native `fetch` + cheerio path.
4. WHEN `process.env.BRIGHT_DATA_WS_ENDPOINT` is not set, THE Scraper SHALL skip the Bright Data path entirely and execute only the native `fetch` + cheerio path.
5. THE Scraper SHALL export a `simulateBrokenScraper` function that, when called, temporarily disables the native fetch path to force a self-healing recovery via the Bright Data CDP path on the next `scrapeUrl` invocation.
6. WHEN the self-healing recovery completes successfully, THE Scraper SHALL restore the native fetch path and log `[self-heal] recovered via Bright Data CDP` to `console.info`.

---

### Requirement 2: Node.js child_process Sandbox for Python Execution

**User Story:** As a developer running the hackathon demo, I want Python challenge code to be executed in a real Node.js child_process rather than returning a stub "ALL_TESTS_PASSED" so that verification results are genuine.

#### Acceptance Criteria

1. WHEN `executeLocalCodeWithTests` is called with `language = 'python'` or `language = 'py'`, THE Local Sandbox SHALL spawn a `child_process` to execute the combined solution and test code using the system Python interpreter (`python3` with `python` as fallback).
2. WHEN the Python child process exits with code 0 and stdout contains `ALL_TESTS_PASSED`, THE Local Sandbox SHALL return `testResults` with `passed: true` and `executionOutput` set to the full stdout.
3. WHEN the Python child process exits with a non-zero code or stdout does not contain `ALL_TESTS_PASSED`, THE Local Sandbox SHALL return `testResults` with `passed: false`, `error` set to the stderr content, and `executionOutput` containing both stdout and stderr.
4. IF the Python child process does not exit within 10 seconds, THEN THE Local Sandbox SHALL terminate the process and return `testResults` with `passed: false` and `error` set to `'Execution timed out after 10s'`.
5. THE Local Sandbox SHALL write the combined code to a temporary file in `os.tmpdir()`, execute it, and delete the temporary file regardless of execution outcome.

---

### Requirement 3: Goal-Scoped Ingest Pipeline

**User Story:** As a user ingesting a source, I want the full pipeline to run against my active goal's competency graph so that changes, deltas, and challenges are scoped to what I am actually learning.

#### Acceptance Criteria

1. WHEN `POST /api/sources/[id]/ingest` is called, THE Pipeline Spine SHALL resolve the Active Goal for the authenticated user by querying the `goals` table for the most recent record where `user_id` matches and `status = 'active'`.
2. IF no Active Goal exists for the user, THEN THE Pipeline Spine SHALL return HTTP 400 with `{ success: false, error: 'No active goal found. Create a goal first.' }`.
3. WHEN the Active Goal is resolved, THE Pipeline Spine SHALL execute the Ingest Pipeline in order: (a) Scraper fetches raw content, (b) Change Engine produces a `TechnicalChange`, (c) the `TechnicalChange` is persisted via `saveTechnicalChange`, (d) `computeImpact` is called with the active goal's `id` and the goal's competency nodes, (e) each `ChangeImpact` is persisted via `saveChangeImpact`, (f) `computeLearningDelta` is called with the resulting impacts, (g) each `LearningDelta` is persisted via `saveLearningDelta`, (h) for each `missing` or `partial` delta, `generateChallenge` is called and the result is persisted via `saveChallenge`.
4. WHEN the pipeline completes successfully, THE Pipeline Spine SHALL update the source record's `ingestion_status` to `'completed'` and return HTTP 200 with the updated source record.
5. IF any pipeline step throws an error, THEN THE Pipeline Spine SHALL update the source record's `ingestion_status` to `'failed'` and return HTTP 500 with `{ success: false, error: <message> }`.
6. WHEN `POST /api/changes` computes impact, THE Changes Route SHALL resolve the Active Goal using the same user-scoped query rather than the `'default-goal-id'` literal.
7. WHEN `GET /api/delta` computes learning deltas, THE Delta Route SHALL resolve the Active Goal using the same user-scoped query rather than the `'default-goal-id'` literal.

---

### Requirement 4: Goals Page with AI Engineer Seed

**User Story:** As a user, I want a real `/goals` page where I can create a custom goal or instantly seed an "AI Engineer" goal so that I have a competency graph to work against without manual setup.

#### Acceptance Criteria

1. THE Goals Page SHALL render at `/goals` and display a list of existing goals for the authenticated user, each showing title, description, status, and creation date.
2. THE Goals Page SHALL display a form with a title input and optional description textarea for creating a new custom goal.
3. WHEN the user submits the create-goal form with a non-empty title, THE Goals Page SHALL call `POST /api/goals`, disable the submit button during the request, and add the returned goal to the list on success.
4. THE Goals Page SHALL display an "AI Engineer" seed button labeled `[+] seed: ai engineer →`.
5. WHEN the user clicks the AI Engineer seed button, THE Goals Page SHALL call `POST /api/goals` with `{ title: "AI Engineer", description: "Master the full AI engineering stack: from Python fundamentals and linear algebra through classical ML, deep learning, transformer architectures, LLM fine-tuning, inference optimization, and production serving systems." }` and add the returned goal to the list on success.
6. WHILE a goal creation request is in flight, THE Goals Page SHALL display a loading state on the triggered button and prevent duplicate submissions.
7. IF the goal creation request fails, THEN THE Goals Page SHALL display the error message inline below the form without navigating away.

---

### Requirement 5: Dashboard Root Page Redesign

**User Story:** As a user, I want the root dashboard (`/`) to show my active goal, skill heatmap, and recent changes feed so that I can orient myself at a glance rather than seeing the learn-session query UI.

#### Acceptance Criteria

1. THE Dashboard SHALL fetch the Active Goal for the authenticated user on mount and display the goal title and a competency progress summary showing proven, partial, and total node counts.
2. WHEN no Active Goal exists, THE Dashboard SHALL display a prompt with a link to `/goals` labeled `[-] no active goal — set one up →`.
3. THE Dashboard SHALL fetch heatmap entries from `GET /api/heatmap` and render a skill heatmap: a grid of day cells for the past 365 days where each cell's fill reflects the `level` field (`none`, `low`, `medium`, `high`) using the design system's surface and success colors.
4. THE Dashboard SHALL fetch technical changes from `GET /api/changes` and render a recent-changes feed showing the five most recent changes, each displaying title, significance badge, affected technologies, and detected-at timestamp.
5. WHEN the changes feed is empty, THE Dashboard SHALL display `[-] no changes detected yet — ingest a source to begin`.
6. THE Dashboard SHALL NOT render the learn-session query textarea or suggestion chips that are currently present on `/`.

---

### Requirement 6: Functional Skill Graph Page

**User Story:** As a user, I want `/skill-graph` to render my active goal's competency graph so that I can see which nodes are proven, partial, stale, or not started.

#### Acceptance Criteria

1. THE Skill Graph Page SHALL fetch competency nodes and edges for the Active Goal from `GET /api/competency` and render each node as a positioned rectangle using the node's `position_x` and `position_y` coordinates.
2. WHEN a node's `evidence_status` is `'proven'`, THE Skill Graph Page SHALL apply the success color (`#30d158`) as the node's border color.
3. WHEN a node's `evidence_status` is `'partial'`, THE Skill Graph Page SHALL apply the warning color (`#ff9f0a`) as the node's border color.
4. WHEN a node's `evidence_status` is `'stale'`, THE Skill Graph Page SHALL apply the danger color (`#ff3b30`) as the node's border color.
5. WHEN a node's `evidence_status` is `'not_started'`, THE Skill Graph Page SHALL apply the hairline border color (`rgba(15,0,0,0.12)`) as the node's border color.
6. THE Skill Graph Page SHALL render edges as SVG lines connecting source and target node centers.
7. IF no Active Goal exists, THEN THE Skill Graph Page SHALL display `[-] no active goal — set one up →` with a link to `/goals`.

---

### Requirement 7: Functional Changes Page

**User Story:** As a user, I want `/changes` to list all detected technical changes so that I can review what has been ingested and understand its impact on my competency graph.

#### Acceptance Criteria

1. THE Changes Page SHALL fetch all technical changes from `GET /api/changes` and render each change as a row showing title, change type, significance, affected technologies, and detected-at date.
2. THE Changes Page SHALL render a significance badge using `badge-warning` for `breaking` and `deprecated`, `badge-success` for `new_capability` and `new_best_practice`, and `badge-default` for `cosmetic` and `documentation`.
3. WHEN the user clicks a change row, THE Changes Page SHALL navigate to `/changes/[id]` showing the full change summary and source excerpt.
4. WHEN the changes list is empty, THE Changes Page SHALL display `[-] no changes detected yet`.
5. THE Changes Page SHALL render a skeleton loader of three rows while the fetch is in progress.

---

### Requirement 8: Functional Challenges Page

**User Story:** As a user, I want `/challenges` to list all generated challenges so that I can find and attempt verification tasks for my competency nodes.

#### Acceptance Criteria

1. THE Challenges Page SHALL fetch challenges from `GET /api/challenges` and render each challenge as a row showing title, difficulty badge, language, estimated minutes, and a link to `/challenges/[id]`.
2. THE Challenges Page SHALL filter challenges to those whose `competency_node_id` belongs to the Active Goal's nodes, displaying only goal-relevant challenges.
3. WHEN the challenges list is empty, THE Challenges Page SHALL display `[-] no challenges generated yet — ingest a source to generate challenges`.
4. THE Challenges Page SHALL render a difficulty badge using `badge-mute` for all three difficulty levels (`beginner`, `intermediate`, `advanced`).

---

### Requirement 9: Functional Progress Page

**User Story:** As a user, I want `/progress` to show my evidence history and competency advancement over time so that I can track what I have proven.

#### Acceptance Criteria

1. THE Progress Page SHALL fetch evidence records from `GET /api/profile` or an appropriate evidence endpoint and display each record showing competency node name, evidence type, confidence delta, and recorded-at timestamp.
2. THE Progress Page SHALL display a summary bar at the top showing total proven nodes, total partial nodes, and total stale nodes for the Active Goal.
3. WHEN no evidence records exist, THE Progress Page SHALL display `[-] no evidence recorded yet — complete a challenge to begin`.

---

### Requirement 10: Counterexample Feedback Preservation

**User Story:** As a user submitting a challenge solution, I want the counterexamples generated on failure to be displayed persistently in the UI so that I understand exactly what invariant my code violated.

#### Acceptance Criteria

1. WHEN `POST /api/challenges/[id]/submit` returns a response where `status = 'failed'` and `counterexamples` is non-empty, THE Challenge Submission UI SHALL render each counterexample showing `input`, `your_result`, `expected`, `failure_trace`, and `invariant_violated` fields inside a proof block (`surface-dark` background).
2. WHEN the user navigates back to the same challenge after a failed submission, THE Challenge Submission UI SHALL re-fetch the most recent submission via `GET /api/challenges/[id]` and re-render the counterexamples if they were previously recorded.
3. THE Verification Engine SHALL preserve the full `counterexamples` array on the `ChallengeSubmission` record written to the database, with no truncation.
4. WHEN `counterexamples` is an empty array, THE Challenge Submission UI SHALL NOT render the counterexample proof block.
