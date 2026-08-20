# Implementation Plan: Bright Data Scraping Architecture

## Overview

Redesign the Delta scraping pipeline so Bright Data Scraper Studio is the unambiguous primary evidence-collection engine. The work spans three files: `lib/ingestion/brightdata.ts` (complete redesign of pipeline logic), `app/api/objectives/[id]/teach/route.ts` (remove fallback content, add 422 + status propagation), and `app/api/certifications/[id]/update/route.ts` (pass `skills`, propagate `scrape_status` in NDJSON events). Property-based tests use [fast-check](https://github.com/dubzzz/fast-check) via Node's built-in `--test` runner.

## Tasks

- [ ] 1. Install fast-check and define shared types
  - [ ] 1.1 Install fast-check as a dev dependency
    - Run `npm install --save-dev fast-check` and verify it appears in `devDependencies`
    - Confirm `tsx --test` can resolve the package (import in a stub test file, then delete the stub)
    - _Requirements: 4.1, 4.2 (property tests require a PBT library)_

  - [ ] 1.2 Define new TypeScript interfaces in `lib/ingestion/brightdata.ts`
    - Add `ExtractionResult`, `ScrapeStatus`, `ValidationResult` interfaces exactly as specified in the design
    - Update `ScrapeStatus` interface to add `source_confidence: 'official_blueprint' | 'provider_derived' | 'fallback_discovered'` field
    - Update `ObjectiveScrapeResult` to add `scrape_status: ScrapeStatus` and optional `extraction_result?: ExtractionResult`
    - Update `ScrapeObjectiveInput` to add `cert_provider?: string` and `skills?: Array<{ official_doc_url?: string; [key: string]: unknown }>`
    - Export all new interfaces so test files and route files can import them
    - _Requirements: 3.1, 7.3, 10.1, 1.6_

- [ ] 2. Implement pure helper functions
  - [ ] 2.1 Implement `resolveOfficialUrl(objective: ScrapeObjectiveInput): string | null`
    - Define `OFFICIAL_DOMAINS` constant (15 hostnames from the glossary)
    - Priority: first `skills[].official_doc_url` whose hostname is in `OFFICIAL_DOMAINS`, then `deriveUrlFromProvider`, then `null`
    - Return both the resolved URL and its `source_confidence` value so the caller can attach it to `ScrapeStatus`
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [ ] 2.2 Implement `deriveUrlFromProvider(provider, objectiveTitle): string | null`
    - Static mapping: Microsoft → `learn.microsoft.com`, AWS → `docs.aws.amazon.com`, GCP/Google → `cloud.google.com`, HashiCorp → `developer.hashicorp.com`, Docker → `docs.docker.com`
    - URL pattern: `https://<domain>/search?q=<slug>` where slug is title lowercased with spaces replaced by `+`
    - Return `null` for unmapped providers
    - _Requirements: 1.3_

  - [ ] 2.3 Implement `validateExtractionResult(data: unknown): ValidationResult`
    - Pure structural check — no Groq call
    - Valid iff: `data.title` non-empty string AND `data.key_concepts` non-empty array AND `key_concepts[0].term` non-empty string AND `key_concepts[0].definition` non-empty string
    - Never throws; on parse failure or bad shape, return `{ is_valid: false, missing_fields: "could not parse extraction result" }`
    - Implement `buildMissingFieldsDescription(data)` as a private helper to construct the `missing_fields` string
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 2.4 Implement `buildDocContentPrompt(objectiveTitle: string): string`
    - Returns the structured extraction prompt string (exact schema from design: `title`, `learning_outcomes`, `key_concepts`, `api_names`, `limits`, `code_examples`)
    - Centralised; identical output every call
    - _Requirements: 3.1, 3.2_

  - [ ]* 2.5 Write property tests for `resolveOfficialUrl` (P2)
    - **Property 2: Official URL resolution selects first valid skill URL**
    - Use `fc.array(fc.record({ official_doc_url: fc.oneof(officialUrl arb, nonOfficialUrl arb) }))` as the `skills` generator
    - Assert: returned URL is always the first entry with an `OFFICIAL_DOMAINS` hostname; non-official entries before it do not affect the result
    - `// Feature: brightdata-scraping-architecture, Property 2: URL resolution selects first valid skill URL`
    - _Requirements: 1.2_

  - [ ]* 2.6 Write property tests for `deriveUrlFromProvider` (P3)
    - **Property 3: Provider derivation returns correct domain**
    - Use `fc.constantFrom('Microsoft', 'AWS', 'GCP', 'Google', 'HashiCorp', 'Docker')` as provider generator
    - Assert: returned URL hostname exactly matches the mapped domain
    - `// Feature: brightdata-scraping-architecture, Property 3: Provider derivation returns correct domain`
    - _Requirements: 1.3_

  - [ ]* 2.7 Write property tests for `validateExtractionResult` (P9, P10)
    - **Property 9: Validation gate output is strictly `{ is_valid, missing_fields }`**
    - **Property 10: Validation verdict matches structural criteria exactly**
    - Generator covers: valid `ExtractionResult` objects, partial objects, null, undefined, empty objects, extra fields
    - Assert P9: output always has exactly `is_valid` (boolean) and `missing_fields` (string), no extra fields
    - Assert P10: `is_valid: true` iff all four structural conditions hold; `false` otherwise
    - `// Feature: brightdata-scraping-architecture, Property 9: Validation gate output shape`
    - `// Feature: brightdata-scraping-architecture, Property 10: Validation verdict matches structural criteria`
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ]* 2.8 Write property tests for `saveCollectorId` Bing preservation (P8)
    - **Property 8: Bing cache entry is never overwritten**
    - Generator: `fc.array(fc.tuple(fc.string(), fc.string(), fc.string()))` for sequences of `(hostname, type, id)` save calls
    - Assert: after any sequence of saves, `getCollectorId("www.bing.com", "documentation_search")` still returns `"c_mt10dg5i258f47a685"`
    - Use a temp file path to avoid touching `.bdata-scrapers.json`
    - `// Feature: brightdata-scraping-architecture, Property 8: Bing cache entry preserved`
    - _Requirements: 8.3_

- [ ] 3. Implement `scrapeDocUrl` and the primary/fallback pipeline in `lib/ingestion/brightdata.ts`
  - [ ] 3.1 Implement `scrapeDocUrl(url, objectiveTitle): Promise<ExtractionResult>`
    - Look up `hostname → doc_content` in Scrapers_Cache; if found, call `scraper run` directly
    - If not found: call `scraper create url prompt --json`, extract `collector_id`, call `saveCollectorId` (log warn on failure, continue), then call `scraper run`
    - Parse `scraper run` output as JSON and return as `ExtractionResult`; throw with reason `"scraper_run_failed"` on CLI error
    - _Requirements: 3.2, 3.3, 3.4, 8.1, 8.2_

  - [ ] 3.2 Implement Fallback Path logic inside `scrapeObjectiveContent`
    - When `resolveOfficialUrl` returns `null`, run the existing Bing collector (`c_mt10dg5i258f47a685`, `www.bing.com → documentation_search`)
    - Parse Bing results; find first URL whose hostname is in `OFFICIAL_DOMAINS`
    - If found: call `scrapeDocUrl` on the discovered URL and set `path: "fallback"` in `ScrapeStatus`
    - If not found: return `ObjectiveScrapeResult` with `scrape_status.outcome: "failed"`, `failure_reason: "no_official_url_found"`
    - If Bing collector throws: return Failure_State with `failure_reason: "fallback_invocation_failed"`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 3.3 Implement full `scrapeObjectiveContent` orchestration with Validation Gate and Heal Loop
    - Call `resolveOfficialUrl`; if non-null use Primary Path (call `scrapeDocUrl`, set `path: "primary"`); else use Fallback Path from 3.2
    - After getting `ExtractionResult`, call `validateExtractionResult`
    - If valid: set `outcome: "valid"`, assemble and return `ObjectiveScrapeResult`
    - If invalid: enter Heal Loop (guard `healAttempted` flag): `scraper heal collectorId missing_fields --json` → `scraper approve collectorId --json` → `scraper run collectorId url --json` → second `validateExtractionResult`
    - If second pass valid: set `healed: true`, `outcome: "valid"`, return success result
    - If second pass invalid or heal throws: return Failure_State with `failure_reason: "validation_failed_after_heal"`
    - Set `combinedContent` to `JSON.stringify(extractionResult)` and `scrapeMethod` to the correct string constant
    - Remove `extractCleanContent` and `executeScraperStudioFlow`; `scrapeWithBrightData` (syllabus) is unchanged
    - _Requirements: 1.1, 1.4, 1.5, 4.1–4.5, 5.1–5.6, 10.1_

  - [ ]* 3.4 Write property test for Fallback Path URL selection (P5)
    - **Property 5: Fallback path URL selection only returns Official_Domains hostnames**
    - Generator: `fc.array(fc.record({ url: fc.oneof(officialUrl arb, nonOfficialUrl arb) }))` for Bing result arrays
    - Assert: selected URL always has a hostname in `OFFICIAL_DOMAINS`, OR result is Failure_State with `failure_reason === "no_official_url_found"` when no official URL exists
    - `// Feature: brightdata-scraping-architecture, Property 5: Fallback path URL selection`
    - _Requirements: 2.2, 2.4_

  - [ ]* 3.5 Write property test for Heal Loop guard (P11)
    - **Property 11: Heal loop runs at most once per pipeline invocation**
    - Mock `runBDataCli` to count `scraper heal` invocations; generate with `fc.integer({ min: 1, max: 5 })` consecutive validation failures
    - Assert: `scraper heal` is called exactly once regardless of how many validation failures occur
    - `// Feature: brightdata-scraping-architecture, Property 11: Heal loop at most once`
    - _Requirements: 5.4_

  - [ ]* 3.6 Write property test for `healed` flag accuracy (P12)
    - **Property 12: Healed status is recorded iff second validation passes**
    - Generator: `fc.boolean()` for second validation outcome; wire to a mocked `validateExtractionResult`
    - Assert: `scrape_status.healed === true` iff heal loop ran AND second validation returned `is_valid: true`; `false` in all other cases
    - `// Feature: brightdata-scraping-architecture, Property 12: Healed flag accuracy`
    - _Requirements: 5.5_

  - [ ]* 3.7 Write property test for cache-hit preventing `scraper create` (P7)
    - **Property 7: Cache hit prevents scraper create**
    - Populate the test cache with a `doc_content` entry for a hostname; mock `runBDataCli` to record calls
    - Assert: `scraper create` is never called when the cache entry exists
    - `// Feature: brightdata-scraping-architecture, Property 7: Cache hit prevents scraper create`
    - _Requirements: 3.3, 8.1, 8.2_

  - [ ] 3.8 Checkpoint — ensure all tests pass
    - Run `npm test` and confirm all property tests and unit tests in `lib/ingestion/` pass
    - Ask the user if any questions arise before proceeding to route changes

- [ ] 4. Update `app/api/objectives/[id]/teach/route.ts`
  - [ ] 4.1 Delete `buildFallbackTeachContent` and its call sites
    - Remove the function definition entirely (not comment it out)
    - Remove the early-return block that calls it when Groq is not configured
    - _Requirements: 6.2, 6.3_

  - [ ] 4.2 Add 422 Failure_State response branch
    - After `await scrapeObjectiveContent(...)`, check `result.scrape_status.outcome === "failed"`
    - Return `NextResponse.json({ success: false, error: "extraction_failed", reason: result.scrape_status.failure_reason, scrape_status: result.scrape_status }, { status: 422 })`
    - Add `user_message` field to the 422 response body, populated from the failure reason translation map: `no_official_url_found` → 'We couldn't find official documentation for this topic right now.', `fallback_invocation_failed` → 'We couldn't reach the documentation source right now. Please try again.', `validation_failed_after_heal` → 'We found the source but couldn't extract the required information, even after an automatic repair attempt.', `scraper_run_failed` → 'We couldn't retrieve the documentation page right now. Please try again.', `missing_scrape_metadata` → 'An internal error occurred while verifying the source. Please try again.'
    - Remove the `catch` block that previously swallowed scrape errors and continued to generate content
    - _Requirements: 6.1, 6.4, 11.1, 11.2_

  - [ ] 4.3 Add Groq-not-configured branch (persist and return 200)
    - When `!isGroqConfigured()`: run scrape, persist sources via `saveScrapedSource`, return `{ success: true, persisted: true, scrape_status: result.scrape_status }`
    - Do NOT call `buildFallbackTeachContent` or `generateTeachContent` in this branch
    - _Requirements: 6.5_

  - [ ] 4.4 Add `heal_badge`, `source_note`, and `scrape_status` to success responses
    - `heal_badge`: include when `scrape_status.healed === true`; format: `"[~] scraper healed — missing <missing_fields> recovered"`
    - `source_note`: include when `scrape_status.path === "fallback"`; value: `"Content URL discovered via Bing search; page scraped directly by Bright Data."`
    - `scrape_status`: always present in every successful response
    - `sources_used`: always `"Bright Data Scraper Studio — " + scrape_status.source_url`
    - `source_label`: translate `scrape_status.source_confidence` to a human-readable string: `official_blueprint` → 'Official source', `provider_derived` → 'Official-domain source discovered automatically', `fallback_discovered` → 'Official-domain source discovered via search'
    - _Requirements: 7.1, 7.2, 7.3, 9.4_

  - [ ] 4.5 Update `generateTeachContent` signature and prompt to consume `ExtractionResult`
    - Change signature to `generateTeachContent(objective, extraction: ExtractionResult, sourceUrl: string)`
    - Pass each field (`learning_outcomes`, `key_concepts`, `api_names`, `limits`, `code_examples`) explicitly in the prompt
    - Empty arrays → `null` in the prompt (not `[]` or omitted key)
    - Add instruction: "Derive facts only from the provided documentation data. Do not add details not present in the source data."
    - Set `sources_used` in the route (not inside the Groq prompt result)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 4.6 Write property test for `sources_used` format (P17)
    - **Property 17: sources_used field matches Bright Data attribution format**
    - Generator: `fc.webUrl()` for arbitrary source URLs
    - Assert: `sources_used === "Bright Data Scraper Studio — " + source_url` for any URL
    - `// Feature: brightdata-scraping-architecture, Property 17: sources_used format`
    - _Requirements: 9.4_

  - [ ]* 4.7 Write property test for empty fields passed as null in Groq prompt (P18)
    - **Property 18: Empty ExtractionResult fields are passed as null in Groq prompt**
    - Generator: `fc.record` with each of `learning_outcomes`, `api_names`, `limits`, `code_examples` independently set to `fc.constant([])` or `fc.array(fc.string(), { minLength: 1 })`
    - Assert: when a field is `[]`, the constructed Groq prompt string contains `"null"` for that field, not `"[]"` and not an omitted key
    - `// Feature: brightdata-scraping-architecture, Property 18: Empty fields as null`
    - _Requirements: 9.3_

  - [ ]* 4.8 Write property test for 422 response shape (P13)
    - **Property 13: Failure_State produces HTTP 422 with correct body shape**
    - Generator: `fc.constantFrom("no_official_url_found", "fallback_invocation_failed", "validation_failed_after_heal", "scraper_run_failed", "missing_scrape_metadata")` for failure reasons
    - Assert: response status is 422, body contains `success: false`, `error: "extraction_failed"`, `reason` equals `failure_reason`, and `scrape_status` object is present
    - `// Feature: brightdata-scraping-architecture, Property 13: HTTP 422 shape for all failure reasons`
    - _Requirements: 6.1, 6.4_

  - [ ]* 4.9 Write property test for `scrape_status` completeness gate (P19)
    - **Property 19: scrape_status required fields always present or trigger missing_scrape_metadata**
    - Generator: `fc.record` where each of `path`, `healed`, `outcome`, `source_url` is independently present or missing
    - Assert: when any required field is missing, the route returns a failure with `reason: "missing_scrape_metadata"`; when all are present, no such failure occurs
    - `// Feature: brightdata-scraping-architecture, Property 19: scrape_status completeness gate`
    - _Requirements: 7.3_

- [ ] 5. Update `app/api/certifications/[id]/update/route.ts`
  - [ ] 5.1 Pass `skills` array into `scrapeObjectiveContent` call
    - Add `skills: obj.skills` to the `scrapeObjectiveContent` argument object
    - If `getObjectivesByCertId` does not currently return a `skills` field, add a DB query or a separate `getSkillsForObjective(obj.id)` call; fall back to `[]` if unavailable
    - _Requirements: 1.2, 10.1_

  - [ ] 5.2 Update the batch result loop to handle `scrape_status.outcome === "failed"` as `objective_error`
    - Replace the fulfilled-but-empty-content warn path: if `scrapeResult.scrape_status.outcome === "failed"`, emit `objective_error` (not `objective_done` or `objective_warn`)
    - Include `scrape_status` in the `objective_error` event payload
    - Ensure no objective emits both `objective_done` and `objective_error`
    - _Requirements: 10.2_

  - [ ] 5.3 Add `scrape_status` to `objective_done` event and Heal_Badge prefix
    - When `scrape_status.healed === true`, prefix the `message` with `"[~] scraper healed — missing <missing_fields> recovered\n"`
    - Always include `scrape_status` object in the `objective_done` event payload
    - _Requirements: 7.4, 10.3_

  - [ ]* 5.4 Write property test for Update Route event types (P15)
    - **Property 15: Update Route emits correct event type per outcome**
    - Generator: `fc.array(fc.oneof(successResult arb, failureResult arb))` for mixed batches of scrape results
    - Assert: each successful result produces exactly one `objective_done`, each failed result produces exactly one `objective_error`, no objective produces both
    - `// Feature: brightdata-scraping-architecture, Property 15: Event type per outcome`
    - _Requirements: 10.2_

  - [ ]* 5.5 Write property test for Heal Badge in `objective_done` message (P16)
    - **Property 16: Heal badge appears in objective_done message when healed**
    - Generator: `fc.boolean()` for `scrape_status.healed`; build a valid `ObjectiveScrapeResult` arb
    - Assert: when `healed === true`, emitted `objective_done` message contains `"[~] scraper healed — missing"`; when `false`, it does not
    - `// Feature: brightdata-scraping-architecture, Property 16: Heal badge in objective_done message`
    - _Requirements: 10.3, 7.1_

- [ ] 6. Validate `ObjectiveScrapeResult` contract across all callers
  - [ ] 6.1 Write property test for `ObjectiveScrapeResult` required fields (P14)
    - **Property 14: ObjectiveScrapeResult always contains all required fields**
    - Generator: drive `scrapeObjectiveContent` with mocked CLI returning varied inputs (valid, partial, error)
    - Assert: returned object always has `scrape_status`, `combinedContent`, `sources`, and `scrapeMethod` — never `undefined` for any of these four
    - `// Feature: brightdata-scraping-architecture, Property 14: ObjectiveScrapeResult required fields`
    - _Requirements: 10.1_

  - [ ] 6.2 Write property test for `ScrapeStatus.path` immutability (P4)
    - **Property 4: ScrapeStatus path is always set correctly**
    - Generator: `fc.boolean()` for whether `resolveOfficialUrl` returns non-null; vary heal outcome with `fc.boolean()`
    - Assert: `scrape_status.path` is `"primary"` when official URL was resolved, `"fallback"` otherwise, and does not change through the heal loop or on failure
    - `// Feature: brightdata-scraping-architecture, Property 4: ScrapeStatus path correctness`
    - _Requirements: 1.5, 2.5_

- [ ] 8. Implement Practice and Retrieval Loop
  - [ ] 8.1 Add practice question generation endpoint `app/api/objectives/[id]/question/route.ts`
    - Accept a POST with `objective_id`; look up the stored `ExtractionResult` for that objective
    - If no valid `ExtractionResult` is found (`outcome !== "valid"`), return HTTP 422 with `{ error: "extraction_failed" }`
    - Call Groq to generate a single practice question grounded only in `key_concepts` and `learning_outcomes` from the `ExtractionResult`
    - Return `{ question: string, options: string[], correct_index: number, explanation: string }` grounded in `ExtractionResult` facts
    - _Requirements: 12.1, 12.2, 12.6_

  - [ ] 8.2 Add answer submission and feedback endpoint `app/api/objectives/[id]/question/submit/route.ts`
    - Accept POST with `objective_id`, `question`, `learner_answer_index`, `correct_index`
    - If answer is correct: return `{ correct: true, feedback: string }` where `feedback` is grounded in `ExtractionResult`
    - If answer is incorrect: return `{ correct: false, feedback: string, weak_topic: true }` — feedback explains why using only `ExtractionResult` facts
    - _Requirements: 12.3, 12.4_

  - [ ] 8.3 Add weak topic tracking to session state
    - When `weak_topic: true` is returned, the client records the `objective_id` as a weak topic
    - The teach route SHALL accept a `?mode=reteach` query param that signals Groq to emphasise `common_mistakes` and `exam_tip` in the generated `Teach_Content`
    - _Requirements: 12.4, 12.5_

  - [ ]* 8.4 Write property test for practice question no-hallucination contract (P22)
    - **Property 22: Practice questions reference only valid Extraction_Results**
    - Generator: `fc.boolean()` for `scrape_status.outcome === "valid"` vs other states
    - Assert: when `outcome !== "valid"`, the endpoint returns HTTP 422; when `outcome === "valid"`, the response contains a non-null question
    - `// Feature: brightdata-scraping-architecture, Property 22: Practice question grounding`
    - _Requirements: 12.2, 12.6_

- [ ] 9. Final checkpoint — ensure all tests pass
  - Run `npm test` and confirm all property-based tests and unit tests pass across all three test files
  - Confirm `scrapeWithBrightData` (syllabus path) still works end-to-end by checking it still compiles and its type signatures have not changed
  - Ask the user if any questions arise before the spec is closed

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 3.8 and 9) ensure incremental validation
- Property tests validate universal correctness properties; they require fast-check (`npm install --save-dev fast-check`)
- Unit tests validate specific examples and edge cases
- `scrapeWithBrightData` (syllabus scraping) is explicitly retained unchanged — do not modify it
- `extractCleanContent` and `executeScraperStudioFlow` are removed as part of task 3.3
- The `OFFICIAL_DOMAINS` constant should be defined once and exported so tests can import it directly
- Practice and Retrieval Loop tasks (Task 8) implement Requirements 12.1–12.6; tasks 8.1–8.3 are required, 8.4 is optional
- The `source_confidence` field is required in `ScrapeStatus` per Requirement 1.6 — ensure it is populated in Task 3.3

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["2.5", "2.6", "2.7", "2.8", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.7"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5", "3.6"] },
    { "id": 5, "tasks": ["3.8", "4.1", "5.1"] },
    { "id": 6, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.2", "5.3"] },
    { "id": 7, "tasks": ["4.6", "4.7", "4.8", "4.9", "5.4", "5.5"] },
    { "id": 8, "tasks": ["6.1", "6.2"] },
    { "id": 9, "tasks": ["9"] },
    { "id": 10, "tasks": ["8.1", "8.2"] },
    { "id": 11, "tasks": ["8.3", "8.4"] }
  ]
}
```
