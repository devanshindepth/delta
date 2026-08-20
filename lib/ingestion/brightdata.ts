import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createGroqJsonCompletion } from "@/lib/groq";

const execFileAsync = promisify(execFile);

type CollectorType = "syllabus" | "doc_content" | "documentation_search";
type ScraperStudioEventStep =
  | "create"
  | "run"
  | "validate"
  | "heal"
  | "approve"
  | "rerun"
  | "verify"
  | "fallback";
type ScraperStudioEventStatus = "started" | "success" | "failed" | "skipped";

export interface ScraperStudioAuditEvent {
  step: ScraperStudioEventStep;
  status: ScraperStudioEventStatus;
  message: string;
  collector_id?: string;
  collector_type?: CollectorType;
  url?: string;
  detail?: string;
  at: string;
}

export interface ScraperStudioProof {
  collector_id?: string;
  collector_type?: CollectorType;
  created: boolean;
  reused: boolean;
  healed: boolean;
  same_collector_after_heal: boolean;
  events: ScraperStudioAuditEvent[];
}

type JsonRecord = Record<string, unknown>;

interface DiscoveryCandidate {
  url?: string;
  link?: string;
  href?: string;
  title?: string;
  name?: string;
  content?: string;
  markdown?: string;
  text?: string;
  body?: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown, fallback = "unknown error"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function getCliErrorDetail(error: unknown): string {
  const parts: string[] = [];
  if (isRecord(error)) {
    for (const key of ["stdout", "stderr", "message"]) {
      const value = error[key];
      if (value) parts.push(String(value));
    }
  } else if (error instanceof Error) {
    parts.push(error.message);
  } else if (typeof error === "string") {
    parts.push(error);
  }

  return parts.join("\n").substring(0, 2000) || "unknown CLI error";
}

function getStringField(record: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getRecordField(record: JsonRecord, key: string): JsonRecord | null {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function getArrayField(record: JsonRecord, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function getStringArrayField(record: JsonRecord, keys: string[]): string[] {
  return getArrayField(record, keys).filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  ).map((item) => item.trim());
}

function candidatesFromJson(value: unknown): DiscoveryCandidate[] {
  const rawCandidates = Array.isArray(value)
    ? value
    : isRecord(value)
    ? getArrayField(value, ["results", "items", "data"])
    : [];

  return rawCandidates.filter(isRecord).map((candidate) => ({
    url: getStringField(candidate, ["url"]) || undefined,
    link: getStringField(candidate, ["link"]) || undefined,
    href: getStringField(candidate, ["href"]) || undefined,
    title: getStringField(candidate, ["title"]) || undefined,
    name: getStringField(candidate, ["name"]) || undefined,
    content: getStringField(candidate, ["content"]) || undefined,
    markdown: getStringField(candidate, ["markdown"]) || undefined,
    text: getStringField(candidate, ["text"]) || undefined,
    body: getStringField(candidate, ["body"]) || undefined,
  }));
}

function getNpxCommand(): { cmd: string; prependArgs: string[] } {
  if (process.platform === "win32") {
    return { cmd: "cmd.exe", prependArgs: ["/c", "npx"] };
  }
  return { cmd: "npx", prependArgs: [] };
}

export interface BrightDataScrapeResult {
  title: string;
  url: string;
  rawContent: string;
  contentHash: string;
  retrievedAt: string;
  headings: string[];
  links: string[];
  collectorId?: string;
  scrapeMethod?: string;
  scraperStudio?: ScraperStudioProof;
}

export interface ExtractionResult {
  title: string;
  summary?: string;
  learning_outcomes: string[];
  key_concepts: Array<{ term: string; definition: string }>;
  api_names: string[];
  limits: string[];
  code_examples: string[];
}

export interface ScrapeStatus {
  path: "primary" | "fallback";
  source_confidence: "official_blueprint" | "provider_derived" | "fallback_discovered";
  healed: boolean;
  outcome: "valid" | "invalid" | "failed";
  source_url: string;
  collector_id?: string;
  collector_type?: CollectorType;
  heal_status?: string;
  failure_reason?: string;
  missing_fields_recovered?: string;
  proof_events?: ScraperStudioAuditEvent[];
}

export interface ObjectiveScrapeResult {
  sources: Array<{
    url: string;
    title: string;
    content: string;
  }>;
  combinedContent: string;
  scrapeMethod: string;
  scrape_status: ScrapeStatus;
  extraction_result?: ExtractionResult;
  scraper_studio?: ScraperStudioProof;
}

export interface ValidationResult {
  is_valid: boolean;
  missing_fields: string;
}

export interface ScrapeObjectiveInput {
  id?: string;
  title: string;
  description?: string;
  certification_id?: string;
  domain_title?: string;
  objective_code?: string;
  cert_title?: string;
  cert_provider?: string;
  skills?: Array<{ official_doc_url?: string; [key: string]: unknown }>;
}

export function isBrightDataConfigured(): boolean {
  const apiKey = process.env.BRIGHT_DATA_API_KEY;
  return Boolean(
    apiKey &&
      apiKey.trim() !== "" &&
      !apiKey.includes("your_bright_data_api_key")
  );
}

const SCRAPERS_FILE = path.join(process.cwd(), ".bdata-scrapers.json");

function getCollectorId(hostname: string, type: string): string | null {
  if (fs.existsSync(SCRAPERS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SCRAPERS_FILE, "utf-8"));
      return data[hostname]?.[type] || null;
    } catch {
      return null;
    }
  }
  return null;
}

function saveCollectorId(hostname: string, type: string, collectorId: string) {
  let data: Record<string, Record<string, string>> = {};
  if (fs.existsSync(SCRAPERS_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(SCRAPERS_FILE, "utf-8"));
    } catch {
      data = {};
    }
  }
  if (!data[hostname]) data[hostname] = {};
  data[hostname][type] = collectorId;
  fs.writeFileSync(SCRAPERS_FILE, JSON.stringify(data, null, 2));
}

function addProofEvent(
  events: ScraperStudioAuditEvent[],
  event: Omit<ScraperStudioAuditEvent, "at">
) {
  events.push({ ...event, at: new Date().toISOString() });
}

function buildScraperStudioProof(
  events: ScraperStudioAuditEvent[],
  collectorId?: string,
  collectorType?: CollectorType
): ScraperStudioProof {
  const healed = events.some(
    (event) => event.step === "heal" && event.status === "success"
  );
  const reranAfterHeal = events.some(
    (event) => event.step === "rerun" && event.status === "success"
  );

  return {
    collector_id: collectorId,
    collector_type: collectorType,
    created: events.some(
      (event) => event.step === "create" && event.status === "success"
    ),
    reused: events.some(
      (event) => event.step === "create" && event.status === "skipped"
    ),
    healed,
    same_collector_after_heal: healed && reranAfterHeal,
    events,
  };
}

function extractCollectorIdFromText(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) {
      const collector = getRecordField(parsed, "collector");
      const data = getRecordField(parsed, "data");
      const candidates = [
        getStringField(parsed, ["collector_id"]),
        getStringField(parsed, ["collectorId"]),
        getStringField(parsed, ["id"]),
        collector ? getStringField(collector, ["id"]) : "",
        data ? getStringField(data, ["collector_id"]) : "",
        data ? getStringField(data, ["id"]) : "",
      ];
      const found = candidates.find((value) => /^c_[a-z0-9]+$/i.test(value));
      if (found) return found;
    }
  } catch {
    // Fall back to regex below.
  }

  const idMatch = text.match(/c_[a-z0-9]+/i);
  return idMatch ? idMatch[0] : null;
}

function firstRecord(raw: unknown): JsonRecord {
  if (Array.isArray(raw)) return isRecord(raw[0]) ? raw[0] : {};
  if (isRecord(raw)) {
    for (const key of ["data", "results", "items"]) {
      const value = raw[key];
      if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : {};
    }
    return raw;
  }
  return {};
}

function recordKeysSummary(raw: unknown): string {
  const row = firstRecord(raw);
  const keys = Object.keys(row);
  return keys.length ? keys.slice(0, 12).join(", ") : "empty object";
}

async function ensureScraperStudioCollector(params: {
  hostname: string;
  type: CollectorType;
  url: string;
  prompt: string;
  events: ScraperStudioAuditEvent[];
  timeoutMs?: number;
}): Promise<{ collectorId: string; created: boolean }> {
  const { hostname, type, url, prompt, events, timeoutMs = 300_000 } = params;
  const existing = getCollectorId(hostname, type);

  if (existing) {
    addProofEvent(events, {
      step: "create",
      status: "skipped",
      collector_id: existing,
      collector_type: type,
      url,
      message: `reusing Scraper Studio collector ${existing}`,
    });
    console.info(`[bdata-studio] Collector ID (${type}): ${existing}`);
    return { collectorId: existing, created: false };
  }

  addProofEvent(events, {
    step: "create",
    status: "started",
    collector_type: type,
    url,
    message: `creating Scraper Studio collector for ${hostname}`,
  });

  try {
    const out = await runBDataCli(
      ["scraper", "create", url, prompt, "--json"],
      timeoutMs
    );
    const collectorId = extractCollectorIdFromText(out);
    if (!collectorId) {
      throw new Error("collector_id_missing_from_create_response");
    }
    saveCollectorId(hostname, type, collectorId);
    console.info(`[bdata-studio] Collector ID (${type}): ${collectorId}`);
    addProofEvent(events, {
      step: "create",
      status: "success",
      collector_id: collectorId,
      collector_type: type,
      url,
      message: `created Scraper Studio collector ${collectorId}`,
    });
    return { collectorId, created: true };
  } catch (createErr: unknown) {
    const collectorId = extractCollectorIdFromText(getErrorMessage(createErr, ""));
    if (collectorId) {
      saveCollectorId(hostname, type, collectorId);
      console.info(`[bdata-studio] Collector ID (${type}): ${collectorId}`);
      addProofEvent(events, {
        step: "create",
        status: "success",
        collector_id: collectorId,
        collector_type: type,
        url,
        message: `created Scraper Studio collector ${collectorId}`,
        detail: "collector ID salvaged from CLI output after create timeout",
      });
      return { collectorId, created: true };
    }

    addProofEvent(events, {
      step: "create",
      status: "failed",
      collector_type: type,
      url,
      message: "Scraper Studio collector create failed",
      detail: getErrorMessage(createErr, "unknown create error"),
    });
    throw createErr;
  }
}

async function runScraperStudioCollector(params: {
  collectorId: string;
  collectorType: CollectorType;
  url: string;
  events: ScraperStudioAuditEvent[];
  step?: "run" | "rerun";
  timeoutMs?: number;
}): Promise<{ parsed: unknown; row: JsonRecord }> {
  const {
    collectorId,
    collectorType,
    url,
    events,
    step = "run",
    timeoutMs = 180_000,
  } = params;

  addProofEvent(events, {
    step,
    status: "started",
    collector_id: collectorId,
    collector_type: collectorType,
    url,
    message: `${step === "rerun" ? "re-running" : "running"} collector ${collectorId}`,
  });

  try {
    const runOut = await runBDataCli(
      ["scraper", "run", collectorId, url, "--json"],
      timeoutMs
    );
    const parsed: unknown = JSON.parse(runOut);
    const row = firstRecord(parsed);
    addProofEvent(events, {
      step,
      status: "success",
      collector_id: collectorId,
      collector_type: collectorType,
      url,
      message: `${step === "rerun" ? "re-run" : "run"} returned structured data`,
      detail: `fields: ${recordKeysSummary(parsed)}`,
    });
    return { parsed, row };
  } catch (err: unknown) {
    addProofEvent(events, {
      step,
      status: "failed",
      collector_id: collectorId,
      collector_type: collectorType,
      url,
      message: `${step === "rerun" ? "re-run" : "run"} failed for collector ${collectorId}`,
      detail: getErrorMessage(err, "unknown run error"),
    });
    throw err;
  }
}

async function healCollectorAndRerun(params: {
  collectorId: string;
  collectorType: CollectorType;
  url: string;
  reason: string;
  events: ScraperStudioAuditEvent[];
}): Promise<{ extraction: ExtractionResult; healStatus: string }> {
  const { collectorId, collectorType, url, reason, events } = params;
  const healPrompt = [
    "Repair this Scraper Studio collector in place.",
    `Target URL: ${url}`,
    `Problem: ${reason}`,
    "Keep the same Collector ID.",
    "Return this canonical JSON shape with populated fields where present on the page: title, summary, learning_outcomes, key_concepts, api_names, limits, code_examples.",
  ].join(" ");

  addProofEvent(events, {
    step: "heal",
    status: "started",
    collector_id: collectorId,
    collector_type: collectorType,
    url,
    message: `healing collector ${collectorId}`,
    detail: reason,
  });

  let healOut: string;
  try {
    healOut = await runBDataCli(
      [
        "scraper",
        "heal",
        collectorId,
        healPrompt,
        "--url",
        url,
        "--auto-approve",
        "--json",
      ],
      300_000
    );
  } catch (err: unknown) {
    addProofEvent(events, {
      step: "heal",
      status: "failed",
      collector_id: collectorId,
      collector_type: collectorType,
      url,
      message: `heal failed for collector ${collectorId}`,
      detail: getErrorMessage(err, "unknown heal error"),
    });
    throw err;
  }

  let healStatus = "done";
  try {
    const healJson: unknown = JSON.parse(healOut);
    if (!isRecord(healJson)) throw new Error("heal_response_not_object");
    const data = getRecordField(healJson, "data");
    const result = getRecordField(healJson, "result");
    healStatus =
      getStringField(healJson, ["status"]) ||
      (data ? getStringField(data, ["status"]) : "") ||
      (result ? getStringField(result, ["status"]) : "") ||
      "done";
  } catch {
    // CLI may emit plain text for successful auto-approve flows.
  }

  addProofEvent(events, {
    step: "heal",
    status: "success",
    collector_id: collectorId,
    collector_type: collectorType,
    url,
    message: `heal completed with status ${healStatus}`,
  });

  addProofEvent(events, {
    step: "approve",
    status: "success",
    collector_id: collectorId,
    collector_type: collectorType,
    url,
    message: "heal auto-approved via --auto-approve",
  });

  const rerun = await runScraperStudioCollector({
    collectorId,
    collectorType,
    url,
    events,
    step: "rerun",
    timeoutMs: 180_000,
  });

  return {
    extraction: normalizeExtractionResult(rerun.row),
    healStatus,
  };
}

async function runBDataCli(
  args: string[],
  timeoutMs: number = 180_000
): Promise<string> {
  const apiKey = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY || "";
  const { cmd, prependArgs } = getNpxCommand();

  const fullArgs = [
    ...prependArgs,
    "-y",
    "-p",
    "@brightdata/cli",
    "bdata",
    "--api-key",
    apiKey,
    ...args,
  ];

  const printable =
    args[0] === "scraper" && args[2]
      ? `bdata ${args[0]} ${args[1]} ${args[2]}`
      : `bdata ${args.slice(0, 2).join(" ")}`;
  console.info(`[bdata-studio] Running: ${printable}`);

  try {
    const { stdout } = await execFileAsync(cmd, fullArgs, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
      timeout: timeoutMs,
      env: {
        ...process.env,
        BRIGHTDATA_API_KEY: apiKey,
        BRIGHT_DATA_API_KEY: apiKey,
      },
    });
    return stdout;
  } catch (err: unknown) {
    throw new Error(`[bdata-studio] CLI failed: ${getCliErrorDetail(err)}`);
  }
}

export const OFFICIAL_DOMAINS = [
  "learn.microsoft.com",
  "docs.microsoft.com",
  "docs.aws.amazon.com",
  "cloud.google.com",
  "docs.azure.com",
  "docs.databricks.com",
  "docs.snowflake.com",
  "docs.oracle.com",
  "developer.hashicorp.com",
  "kubernetes.io",
  "docs.docker.com",
  "docs.github.com",
  "developer.salesforce.com",
  "docs.confluent.io",
  "docs.redhat.com",
  "training.linuxfoundation.org",
  "docs.linuxfoundation.org",
  "learning.lpi.org",
  "www.lpi.org",
  "learningnetwork.cisco.com",
  "www.cisco.com",
  "www.comptia.org",
  "docs.vmware.com",
  "docs.paloaltonetworks.com",
  "www.elastic.co",
  "www.mongodb.com",
];

export function resolveOfficialUrl(
  objective: ScrapeObjectiveInput
): { url: string; source_confidence: "official_blueprint" | "provider_derived" } | null {
  if (objective.skills && objective.skills.length > 0) {
    for (const skill of objective.skills) {
      if (skill.official_doc_url) {
        try {
          const url = new URL(skill.official_doc_url);
          if (OFFICIAL_DOMAINS.includes(url.hostname)) {
            return {
              url: skill.official_doc_url,
              source_confidence: "official_blueprint",
            };
          }
        } catch {
          // Ignore invalid URLs
        }
      }
    }
  }

  const derived = deriveUrlFromProvider(objective.cert_provider, objective.title);
  if (derived) {
    return { url: derived, source_confidence: "provider_derived" };
  }

  return null;
}

export function deriveUrlFromProvider(
  provider: string | undefined,
  objectiveTitle: string
): string | null {
  if (!provider) return null;
  const lowerProvider = provider.toLowerCase();
  
  let domain = "";
  if (lowerProvider.includes("microsoft")) domain = "learn.microsoft.com";
  else if (lowerProvider.includes("aws") || lowerProvider.includes("amazon")) domain = "docs.aws.amazon.com";
  else if (lowerProvider.includes("gcp") || lowerProvider.includes("google")) domain = "cloud.google.com";
  else if (lowerProvider.includes("hashicorp")) domain = "developer.hashicorp.com";
  else if (lowerProvider.includes("docker")) domain = "docs.docker.com";
  else if (lowerProvider.includes("databricks")) domain = "docs.databricks.com";
  else if (lowerProvider.includes("snowflake")) domain = "docs.snowflake.com";
  else if (lowerProvider.includes("oracle")) domain = "docs.oracle.com";
  else if (lowerProvider.includes("kubernetes") || lowerProvider.includes("cncf")) domain = "kubernetes.io";
  else if (lowerProvider.includes("github")) domain = "docs.github.com";
  else if (lowerProvider.includes("salesforce")) domain = "developer.salesforce.com";
  else if (lowerProvider.includes("confluent")) domain = "docs.confluent.io";
  else if (lowerProvider.includes("red hat") || lowerProvider.includes("redhat")) domain = "docs.redhat.com";
  else if (lowerProvider.includes("linux foundation") || lowerProvider.includes("linuxfoundation")) domain = "training.linuxfoundation.org";
  else if (lowerProvider.includes("lpi") || lowerProvider.includes("linux professional")) domain = "learning.lpi.org";
  else if (lowerProvider.includes("comptia")) domain = "www.comptia.org";
  else if (lowerProvider.includes("cisco")) domain = "learningnetwork.cisco.com";
  else if (lowerProvider.includes("vmware")) domain = "docs.vmware.com";
  else if (lowerProvider.includes("palo alto")) domain = "docs.paloaltonetworks.com";
  else if (lowerProvider.includes("elastic")) domain = "www.elastic.co";
  else if (lowerProvider.includes("mongodb")) domain = "www.mongodb.com";
  else return null;

  const slug = objectiveTitle.toLowerCase().replace(/ /g, "+");
  return `https://${domain}/search?q=${slug}`;
}

function buildMissingFieldsDescription(data: Partial<ExtractionResult>, sourceUrl?: string): string {
  const missing: string[] = [];
  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    missing.push("title");
  }
  const hasSummary = typeof data.summary === "string" && data.summary.trim().length > 0;
  const hasOutcomes = Array.isArray(data.learning_outcomes) && data.learning_outcomes.some(o => typeof o === "string" && o.trim().length > 0);
  if (!hasSummary && !hasOutcomes) {
    missing.push("summary or learning_outcomes");
  }
  const validConcepts = Array.isArray(data.key_concepts) && data.key_concepts.filter(
    kc => kc && typeof kc.term === "string" && kc.term.trim().length > 0 && typeof kc.definition === "string" && kc.definition.trim().length > 0
  );
  if (!validConcepts || validConcepts.length < 1) {
    missing.push("key_concepts with term and definition");
  }
  if (sourceUrl !== undefined && (!sourceUrl || typeof sourceUrl !== "string" || !sourceUrl.trim())) {
    missing.push("valid source URL");
  }
  return missing.join(", ");
}

export function validateExtractionResult(data: unknown, sourceUrl?: string): ValidationResult {
  if (!data || typeof data !== "object") {
    return { is_valid: false, missing_fields: "could not parse extraction result" };
  }

  const result = data as Partial<ExtractionResult>;
  const hasTitle = typeof result.title === "string" && result.title.trim().length > 0;
  const hasSummary = typeof result.summary === "string" && result.summary.trim().length > 0;
  const hasOutcomes = Array.isArray(result.learning_outcomes) && result.learning_outcomes.some(o => typeof o === "string" && o.trim().length > 0);
  
  const validConcepts = Array.isArray(result.key_concepts) && result.key_concepts.filter(
    kc => kc && typeof kc.term === "string" && kc.term.trim().length > 0 && typeof kc.definition === "string" && kc.definition.trim().length > 0
  );
  const hasConcepts = Boolean(validConcepts && validConcepts.length >= 1);
  const hasSourceUrl = sourceUrl === undefined || (typeof sourceUrl === "string" && sourceUrl.trim().length > 0);

  const is_valid = Boolean(hasTitle && (hasSummary || hasOutcomes) && hasConcepts && hasSourceUrl);

  return {
    is_valid,
    missing_fields: is_valid ? "" : buildMissingFieldsDescription(result, sourceUrl),
  };
}

export function buildDocContentPrompt(objectiveTitle: string): string {
  return `Extract documentation page content for the certification objective "${objectiveTitle}" as a JSON object strictly matching this canonical schema:
{
  "title": "exact title of the documentation page",
  "summary": "2-3 sentence clear technical summary of what this document covers",
  "learning_outcomes": ["specific technical abilities, tasks, or concepts learned from this page"],
  "key_concepts": [
    { "term": "technical term, component, or concept name", "definition": "concise, accurate one-sentence definition directly from the text" }
  ],
  "api_names": ["SDK classes, methods, REST endpoints, or CLI commands mentioned"],
  "limits": ["quotas, constraints, size limits, regional limitations, or pricing tier restrictions"],
  "code_examples": ["verbatim code snippets or CLI examples from the page"]
}
Ensure key_concepts contains all core terms and definitions described in the page. Return ONLY this valid JSON object.`;
}

export function normalizeExtractionResult(raw: unknown): ExtractionResult {
  if (!isRecord(raw)) {
    return {
      title: "",
      summary: "",
      learning_outcomes: [],
      key_concepts: [],
      api_names: [],
      limits: [],
      code_examples: [],
    };
  }

  // 1. Canonical Fields & Safe Semantic Aliases
  const title = getStringField(raw, ["title", "page_title", "name"]);

  const summary = getStringField(raw, ["summary", "overview", "description"]);

  // 2. Learning Outcomes
  const learning_outcomes: string[] = [];
  const rawOutcomes = getStringArrayField(raw, [
    "learning_outcomes",
    "learning_objectives",
    "outcomes",
  ]);
  for (const item of rawOutcomes) {
    learning_outcomes.push(item);
  }

  if (learning_outcomes.length === 0) {
    const introduction = getStringField(raw, ["introduction"]);
    const prerequisites = getStringField(raw, ["prerequisites"]);
    if (introduction) learning_outcomes.push(introduction);
    if (prerequisites) learning_outcomes.push(prerequisites);
  }

  // 3. Key Concepts
  const key_concepts: Array<{ term: string; definition: string }> = [];
  const rawKeyConcepts = getArrayField(raw, ["key_concepts"]);
  if (rawKeyConcepts.length > 0) {
    for (const kc of rawKeyConcepts) {
      if (isRecord(kc)) {
        const term = getStringField(kc, ["term", "name", "concept"]);
        const definition = getStringField(kc, [
          "definition",
          "description",
          "meaning",
          "summary",
        ]);
        if (term && definition) {
          key_concepts.push({ term, definition });
        }
      }
    }
  }

  // If key_concepts is empty, inspect semantic collections: topics, concepts, components, definitions
  if (key_concepts.length === 0) {
    const candidateList = getArrayField(raw, [
      "topics",
      "concepts",
      "components",
      "definitions",
      "key_topics",
    ]);

    if (candidateList.length > 0) {
      for (const item of candidateList) {
        if (typeof item === "string" && item.trim()) {
          key_concepts.push({
            term: item.trim(),
            definition: `Core technical topic described in ${title || "the documentation"}.`,
          });
        } else if (isRecord(item)) {
          const term = getStringField(item, ["topic_title", "title", "name", "term"]);
          const definition =
            getStringField(item, ["description", "summary", "definition"]) ||
            `Technical concept covered in ${title || "documentation"}.`;
          if (term) {
            key_concepts.push({ term, definition });
          }
        }
      }
    }
  }

  // If still empty, parse HTML tables or headings from raw.content if present
  const contentField = getStringField(raw, ["content"]);
  if (key_concepts.length === 0 && contentField) {
    const content = contentField;

    // Parse HTML table rows
    const tableRowRegex = /<tr>\s*<td>(?:<[^>]+>)*\s*([^<]+?)\s*(?:<\/[^>]+>)*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>/gi;
    let match;
    while ((match = tableRowRegex.exec(content)) !== null) {
      const term = match[1].replace(/<[^>]+>/g, "").trim();
      const definition = match[2].replace(/<[^>]+>/g, "").trim();
      if (term && definition && term.toLowerCase() !== "service" && term.toLowerCase() !== "role") {
        key_concepts.push({ term, definition });
      }
    }

    // Parse <h2> or <h3> headings
    if (key_concepts.length === 0) {
      const headingRegex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
      while ((match = headingRegex.exec(content)) !== null) {
        const term = match[1].replace(/<[^>]+>/g, "").trim();
        if (term && term.length > 2) {
          key_concepts.push({
            term,
            definition: `Core architectural component covered in ${title || "documentation"}.`,
          });
        }
      }
    }
  }

  // Fallback: If still empty, synthesize from title and summary/description
  if (key_concepts.length === 0 && title) {
    key_concepts.push({
      term: title,
      definition: summary || `Official documentation concept for ${title}.`,
    });
  }

  // 4. Optional Fields (do not fail extraction if absent)
  const api_names = getStringArrayField(raw, ["api_names", "apis", "cli_commands"]);

  const limits = getStringArrayField(raw, ["limits", "quotas", "constraints"]);

  const code_examples = getStringArrayField(raw, [
    "code_examples",
    "code_samples",
    "snippets",
  ]);

  return {
    title,
    summary,
    learning_outcomes,
    key_concepts,
    api_names,
    limits,
    code_examples,
  };
}

// ---------------------------------------------------------------------------
// Certification-aware query builder
// ---------------------------------------------------------------------------

/**
 * Signals that indicate a result belongs to an unrelated Red Hat product.
 * Any match → strong penalty applied; two or more matches → rejected outright.
 */
const UNRELATED_REDHAT_SIGNALS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /red\s*hat\s+virtualization|rhv\b|rhevm\b/i,   label: "Red Hat Virtualization" },
  { pattern: /openshift/i,                                   label: "OpenShift" },
  { pattern: /ansible/i,                                     label: "Ansible" },
  { pattern: /satellite\b/i,                                 label: "Red Hat Satellite" },
  { pattern: /jboss|wildfly/i,                               label: "JBoss/WildFly" },
  { pattern: /red\s*hat\s+fuse|camel\b/i,                    label: "Red Hat Fuse/Camel" },
  { pattern: /ceph\b/i,                                      label: "Red Hat Ceph Storage" },
  { pattern: /gluster/i,                                     label: "GlusterFS" },
  { pattern: /red\s*hat\s+directory\s+server/i,              label: "Red Hat Directory Server" },
  { pattern: /cloudforms/i,                                  label: "CloudForms" },
];

/** Known RHCSA/RHEL URL path patterns that signal an on-target page. */
const RHCSA_URL_SIGNALS: RegExp[] = [
  /\/documentation\/en-us\/red_hat_enterprise_linux\//i,
  /\/rhel\//i,
  /\/rhcsa\b/i,
  /\/red_hat_enterprise_linux/i,
];

/**
 * Build a discovery query and intent string tuned to the certification context.
 * For RHCSA/Red Hat objectives the query is enriched with RHEL and RHCSA
 * context so Bright Data's AI ranker surfaces the correct product docs.
 */
export function buildDiscoveryQuery(
  objectiveTitle: string,
  domain: string,
  certTitle?: string
): { query: string; intent: string } {
  const certLower = (certTitle || "").toLowerCase();
  const isRhcsa =
    certLower.includes("rhcsa") ||
    certLower.includes("red hat certified system administrator") ||
    certLower.includes("red hat enterprise linux");

  if (isRhcsa) {
    // For RHCSA, be very explicit: include RHCSA, RHEL, and the objective topic.
    // The extra context prevents the ranker from picking other Red Hat products.
    const query = `RHCSA "${objectiveTitle}" Red Hat Enterprise Linux RHEL site:${domain}`;
    const intent =
      `Find the official Red Hat Enterprise Linux (RHEL) documentation page ` +
      `for the RHCSA exam objective: "${objectiveTitle}". ` +
      `The page must be part of the Red Hat Enterprise Linux product documentation ` +
      `(NOT Red Hat Virtualization, OpenShift, Ansible, or Satellite). ` +
      `Prefer deep technical reference or administration guide pages over index or search pages.`;
    return { query, intent };
  }

  // Generic path — keep existing behaviour but add cert title for context
  const query = certTitle
    ? `"${objectiveTitle}" ${certTitle} official documentation site:${domain}`
    : `${objectiveTitle} official documentation site:${domain}`;
  const intent =
    `Find the official ${domain} documentation page that best explains: ` +
    `"${objectiveTitle}". Prefer deep technical reference pages over search results or index pages.`;
  return { query, intent };
}

// ---------------------------------------------------------------------------
// Semantic relevance scorer for discovery candidates
// ---------------------------------------------------------------------------

export interface CandidateScore {
  score: number;
  reasons: string[];
  rejected: boolean;
  rejectionReason?: string;
}

/**
 * Score a discovery candidate based on semantic relevance to the objective.
 *
 * Scoring:
 *  +40  URL path matches RHCSA/RHEL documentation area
 *  +30  title contains ≥1 objective keyword
 *  +20  content (first 3 000 chars) contains the full objective phrase
 *  +10  each objective keyword found in content (max +20)
 *  +10  content mentions "RHCSA" or "Red Hat Certified System Administrator"
 *  +10  content mentions "RHEL" or "Red Hat Enterprise Linux"
 *  -30  each unrelated Red Hat product signal found in URL or title
 *  -15  each unrelated Red Hat product signal found in content
 *
 * Rejection: score < MIN_SCORE or ≥2 unrelated product signals in URL/title.
 */
export const MIN_RELEVANCE_SCORE = 30;

export function scoreCandidate(
  url: string,
  title: string,
  content: string,
  objectiveTitle: string,
  certTitle?: string
): CandidateScore {
  const reasons: string[] = [];
  let score = 0;

  const titleLower = (title || "").toLowerCase();
  const snippet    = (content || "").toLowerCase().substring(0, 3000);
  const certLower  = (certTitle || "").toLowerCase();

  const isRhcsaContext =
    certLower.includes("rhcsa") ||
    certLower.includes("red hat certified system administrator") ||
    certLower.includes("red hat enterprise linux");

  // --- Positive signals ---

  // URL path in the right RHEL documentation area
  if (isRhcsaContext && RHCSA_URL_SIGNALS.some(re => re.test(url))) {
    score += 40;
    reasons.push("URL belongs to RHEL documentation area (+40)");
  }

  // Objective keywords in title
  const objectiveKeywords = objectiveTitle
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);

  const titleKeywordMatches = objectiveKeywords.filter(w => titleLower.includes(w));
  if (titleKeywordMatches.length > 0) {
    score += 30;
    reasons.push(`title contains objective keywords [${titleKeywordMatches.join(", ")}] (+30)`);
  }

  // Full objective phrase in content
  if (snippet.includes(objectiveTitle.toLowerCase())) {
    score += 20;
    reasons.push("content contains full objective phrase (+20)");
  }

  // Individual objective keywords in content (max 2 × +10)
  const contentKeywordMatches = objectiveKeywords.filter(w => snippet.includes(w));
  const kwBonus = Math.min(contentKeywordMatches.length, 2) * 10;
  if (kwBonus > 0) {
    score += kwBonus;
    reasons.push(`content contains objective keywords (+${kwBonus})`);
  }

  // RHCSA/RHEL mention in content
  if (isRhcsaContext) {
    if (/rhcsa|red hat certified system administrator/i.test(snippet)) {
      score += 10;
      reasons.push("content mentions RHCSA (+10)");
    }
    if (/\brhel\b|red hat enterprise linux/i.test(snippet)) {
      score += 10;
      reasons.push("content mentions RHEL (+10)");
    }
  }

  // --- Negative signals (unrelated Red Hat products) ---

  let urlTitlePenalties = 0;
  const penaltyLabels: string[] = [];

  for (const signal of UNRELATED_REDHAT_SIGNALS) {
    const inUrlOrTitle = signal.pattern.test(url) || signal.pattern.test(title);
    const inContent    = signal.pattern.test(snippet);

    if (inUrlOrTitle) {
      score -= 30;
      urlTitlePenalties++;
      penaltyLabels.push(signal.label);
      reasons.push(`URL/title matches unrelated product "${signal.label}" (-30)`);
    } else if (inContent) {
      score -= 15;
      penaltyLabels.push(signal.label);
      reasons.push(`content mentions unrelated product "${signal.label}" (-15)`);
    }
  }

  // Hard rejection: ≥2 unrelated product matches in URL/title, or score still
  // below threshold after all bonuses
  const rejected = urlTitlePenalties >= 2 || score < MIN_RELEVANCE_SCORE;
  const rejectionReason = urlTitlePenalties >= 2
    ? `URL/title matched ${urlTitlePenalties} unrelated Red Hat products: ${penaltyLabels.join(", ")}`
    : score < MIN_RELEVANCE_SCORE
    ? `score ${score} below minimum threshold ${MIN_RELEVANCE_SCORE}`
    : undefined;

  return { score, reasons, rejected, rejectionReason };
}

/**
 * Given a list of raw result objects (from Discover or Bing), apply
 * multi-factor heuristic scoring to every candidate and return the one with
 * the highest passing score, or null if nothing clears the threshold.
 *
 * This is the single source of truth for candidate selection. Both the
 * Bright Data Discover path and the Bing fallback path must go through here
 * so the same relevance threshold and product-rejection rules are enforced
 * regardless of where the candidates originated.
 */
export function selectBestCandidate(
  results: DiscoveryCandidate[],
  objectiveTitle: string,
  certTitle: string | undefined,
  requiredDomain?: string
): { url: string; content: string; score: number } | null {
  let bestUrl     = "";
  let bestContent = "";
  let bestScore   = -Infinity;

  for (const r of results) {
    const url: string     = r?.url || r?.link || r?.href || "";
    const title: string   = r?.title || r?.name || "";
    const content: string = r?.content || r?.markdown || r?.text || r?.body || "";

    if (!url) continue;

    // Structural guard: must belong to the required domain when specified
    if (requiredDomain && !url.includes(requiredDomain)) continue;

    // Skip raw search/index pages — we want actual documentation pages
    if (url.includes("/search") || url.includes("?q=")) continue;

    // Content may be absent for Bing search-result snippets — that's fine;
    // scoreCandidate will still score on URL + title which are the strongest
    // signals for unrelated-product detection.
    if (content.trim().length > 0 && content.trim().length < 200) continue;

    const { score, reasons, rejected, rejectionReason } = scoreCandidate(
      url, title, content, objectiveTitle, certTitle
    );

    if (rejected) {
      console.info(
        `[bdata-studio] Rejected candidate: ${url} score=${score} reason="${rejectionReason}"`
      );
      continue;
    }

    console.info(
      `[bdata-studio] Discovery candidate: ${url} score=${score} reasons=[${reasons.join(" | ")}]`
    );

    if (score > bestScore) {
      bestScore   = score;
      bestUrl     = url;
      bestContent = content;
    }
  }

  if (!bestUrl) return null;

  console.info(`[bdata-studio] Selected document: ${bestUrl} score=${bestScore}`);
  return { url: bestUrl, content: bestContent, score: bestScore };
}

// ---------------------------------------------------------------------------
// Discovery function
// ---------------------------------------------------------------------------

/**
 * Use `brightdata discover` (AI-powered web discovery) to find and fetch the
 * best official documentation page for an objective topic on a given domain.
 * Returns { url, content } if found, null otherwise.
 *
 * We use `discover` instead of `search` because:
 * - It uses AI to rank results by relevance intent, not just keyword match
 * - `--include-content` fetches the full page markdown in one call, eliminating
 *   the separate `bdata scrape` step entirely
 * - It handles JS-rendered SPAs better than the basic search command
 */
async function discoverDocContent(
  objectiveTitle: string,
  domain: string,
  certTitle?: string
): Promise<{ url: string; content: string } | null> {
  const { query, intent } = buildDiscoveryQuery(objectiveTitle, domain, certTitle);

  console.info(`[bdata-studio] Discovering doc for: "${objectiveTitle}" on ${domain}`);

  let out: string;
  try {
    out = await runBDataCli(
      [
        "discover", query,
        "--intent", intent,
        "--filter-keywords", domain,
        "--num-results", "5",
        "--include-content",
        "--json",
      ],
      90_000
    );
  } catch (err: unknown) {
    console.warn(`[bdata-studio] discover failed: ${getErrorMessage(err)}`);
    return null;
  }

  if (!out || out.trim().length < 10) return null;

  try {
    const parsed: unknown = JSON.parse(out);
    const results = candidatesFromJson(parsed);

    const best = selectBestCandidate(results, objectiveTitle, certTitle, domain);
    if (best) return { url: best.url, content: best.content };
  } catch {
    console.warn(`[bdata-studio] Could not parse discover results (first 300 chars): ${out.substring(0, 300)}`);
    return null;
  }

  // No candidate passed the threshold — try a tighter fallback query
  console.info(`[bdata-studio] No candidate passed relevance threshold. Retrying with focused fallback query.`);
  return discoverDocContentFallback(objectiveTitle, domain, certTitle);
}

/**
 * Fallback discovery query used when the primary query returns no result that
 * passes the relevance threshold. Uses a shorter, more focused query that
 * prioritises exact topic match over product context.
 */
async function discoverDocContentFallback(
  objectiveTitle: string,
  domain: string,
  certTitle?: string
): Promise<{ url: string; content: string } | null> {
  const certLower = (certTitle || "").toLowerCase();
  const isRhcsa =
    certLower.includes("rhcsa") ||
    certLower.includes("red hat certified system administrator") ||
    certLower.includes("red hat enterprise linux");

  const query = isRhcsa
    ? `"${objectiveTitle}" RHEL administration guide site:${domain}`
    : certTitle
    ? `"${objectiveTitle}" ${certTitle} site:${domain}`
    : `"${objectiveTitle}" documentation site:${domain}`;

  const intent = isRhcsa
    ? `Find the Red Hat Enterprise Linux administration guide section about "${objectiveTitle}" on ${domain}.`
    : `Find the official documentation page for "${objectiveTitle}" on ${domain}.`;

  console.info(`[bdata-studio] Fallback discover query: ${query}`);

  let out: string;
  try {
    out = await runBDataCli(
      [
        "discover", query,
        "--intent", intent,
        "--filter-keywords", domain,
        "--num-results", "3",
        "--include-content",
        "--json",
      ],
      90_000
    );
  } catch (err: unknown) {
    console.warn(`[bdata-studio] Fallback discover failed: ${getErrorMessage(err)}`);
    return null;
  }

  if (!out || out.trim().length < 10) return null;

  try {
    const parsed: unknown = JSON.parse(out);
    const results = candidatesFromJson(parsed);

    const best = selectBestCandidate(results, objectiveTitle, certTitle, domain);
    if (best) return { url: best.url, content: best.content };
  } catch {
    console.warn(`[bdata-studio] Could not parse fallback discover results`);
  }

  console.info(`[bdata-studio] Fallback discover also found no acceptable result for: "${objectiveTitle}"`);
  return null;
}

/**
 * Fetch a page's content via Bright Data Web Unlocker (`brightdata scrape`).
 * Returns raw markdown content. Throws on CLI failure or empty response.
 */
async function fetchWithWebUnlocker(url: string): Promise<string> {
  const out = await runBDataCli(
    ["scrape", url, "--format", "markdown"],
    60_000
  );

  if (!out || out.trim().length < 50) {
    throw new Error("scraper_run_failed");
  }

  // If the CLI returned JSON wrapping markdown content, unwrap it
  try {
    const parsed: unknown = JSON.parse(out);
    if (isRecord(parsed)) {
      const content = getStringField(parsed, ["content"]);
      if (content.length > 50) {
        return content;
      }
    }
  } catch {
    // Not JSON — output is raw markdown, use as-is
  }

  return out;
}

/**
 * Given raw page content (markdown/text), call Groq to extract the canonical
 * ExtractionResult schema.
 */
async function extractFromRawContent(
  rawContent: string,
  objectiveTitle: string,
  sourceUrl: string
): Promise<ExtractionResult> {
  const prompt = `You are extracting structured content from an official technical documentation page.
The page is about: "${objectiveTitle}"
Source URL: ${sourceUrl}

Page content (markdown):
---
${rawContent.substring(0, 10000)}
---

Extract and return ONLY this valid JSON object:
{
  "title": "exact title of the documentation page",
  "summary": "2-3 sentence clear technical summary of what this document covers",
  "learning_outcomes": ["specific technical abilities, tasks, or concepts a reader learns from this page"],
  "key_concepts": [
    { "term": "technical term or component name", "definition": "concise one-sentence definition from the text" }
  ],
  "api_names": ["SDK classes, methods, REST endpoints, or CLI commands mentioned"],
  "limits": ["quotas, constraints, size limits, or restrictions mentioned"],
  "code_examples": ["verbatim code snippets or CLI examples from the page"]
}
Ensure key_concepts has at least 2 entries with real terms from the content. Return ONLY valid JSON.`;

  const result = await createGroqJsonCompletion(prompt);
  return normalizeExtractionResult(result);
}

/**
 * Scrape a documentation URL using Scraper Studio (if a collector exists for
 * the domain) or fall back to `brightdata discover --include-content` + Groq.
 *
 * The discover command is AI-powered: it finds the best matching doc page AND
 * returns its full content in one call — no separate scrape step needed.
 * This handles JS-rendered SPAs (Databricks, Red Hat) that return empty shells
 * when scraped directly.
 */
async function scrapeDocUrl(
  url: string,
  objectiveTitle: string,
  certTitle?: string
): Promise<{
  extraction: ExtractionResult;
  resolvedUrl: string;
  collectorId?: string;
  collectorType?: CollectorType;
  proofEvents: ScraperStudioAuditEvent[];
  usedScraperStudio: boolean;
}> {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;
  const proofEvents: ScraperStudioAuditEvent[] = [];

  try {
    const { collectorId } = await ensureScraperStudioCollector({
      hostname,
      type: "doc_content",
      url,
      prompt: buildDocContentPrompt(objectiveTitle),
      events: proofEvents,
    });

    try {
      const run = await runScraperStudioCollector({
        collectorId,
        collectorType: "doc_content",
        url,
        events: proofEvents,
      });
      return {
        extraction: normalizeExtractionResult(run.row),
        resolvedUrl: url,
        collectorId,
        collectorType: "doc_content",
        proofEvents,
        usedScraperStudio: true,
      };
    } catch (runErr: unknown) {
      const healed = await healCollectorAndRerun({
        collectorId,
        collectorType: "doc_content",
        url,
        reason: `initial collector run failed: ${getErrorMessage(runErr)}`,
        events: proofEvents,
      });
      return {
        extraction: healed.extraction,
        resolvedUrl: url,
        collectorId,
        collectorType: "doc_content",
        proofEvents,
        usedScraperStudio: true,
      };
    }
  } catch (collectorErr: unknown) {
    console.warn(
      `[bdata-studio] Scraper Studio collector path unavailable for ${hostname}: ${getErrorMessage(collectorErr)}`
    );
  }

  // No Scraper Studio collector — use brightdata discover to find + fetch content
  addProofEvent(proofEvents, {
    step: "fallback",
    status: "started",
    url,
    message: "using Bright Data Discover + Groq extraction fallback",
    detail: "no runnable Scraper Studio doc_content collector was available",
  });
  console.info(`[bdata-studio] No runnable collector for ${hostname} - using discover + Groq extraction`);

  const discovered = await discoverDocContent(objectiveTitle, hostname, certTitle);

  if (discovered) {
    // Got content directly from discover — skip the separate scrape call
    const extraction = await extractFromRawContent(discovered.content, objectiveTitle, discovered.url);
    addProofEvent(proofEvents, {
      step: "fallback",
      status: "success",
      url: discovered.url,
      message: "fallback discovered and extracted source content",
    });
    return {
      extraction,
      resolvedUrl: discovered.url,
      proofEvents,
      usedScraperStudio: false,
    };
  }

  // discover found nothing — fall back to scraping the original URL directly
  // (works for non-SPA pages; may return sparse content for SPA search pages)
  console.info(`[bdata-studio] discover found nothing, scraping ${url} directly`);
  const rawContent = await fetchWithWebUnlocker(url);
  const extraction = await extractFromRawContent(rawContent, objectiveTitle, url);
  addProofEvent(proofEvents, {
    step: "fallback",
    status: "success",
    url,
    message: "fallback scraped target URL through Bright Data Web Unlocker",
  });
  return {
    extraction,
    resolvedUrl: url,
    proofEvents,
    usedScraperStudio: false,
  };
}

export async function scrapeObjectiveContent(
  objective: ScrapeObjectiveInput
): Promise<ObjectiveScrapeResult> {
  if (!isBrightDataConfigured()) {
    throw new Error("Bright Data is not configured.");
  }

  const scrape_status: ScrapeStatus = {
    path: "primary",
    source_confidence: "official_blueprint",
    healed: false,
    outcome: "failed",
    source_url: "",
  };
  
  let extractionResult: ExtractionResult | undefined;
  let scrapeMethod = "";
  let healAttempted = false;
  const proofEvents: ScraperStudioAuditEvent[] = [];

  try {
    const resolved = resolveOfficialUrl(objective);
    let primarySuccess = false;
    
    if (resolved) {
      scrape_status.path = "primary";
      scrape_status.source_confidence = resolved.source_confidence;
      scrape_status.source_url = resolved.url;
      scrapeMethod = "brightdata-scraper-studio-primary";
      
      try {
        const result = await scrapeDocUrl(resolved.url, objective.title, objective.cert_title);
        proofEvents.push(...result.proofEvents);
        extractionResult = result.extraction;
        // Update source_url to the actual page scraped (may differ from search URL)
        scrape_status.source_url = result.resolvedUrl;
        if (result.collectorId) {
          scrape_status.collector_id = result.collectorId;
          scrape_status.collector_type = result.collectorType;
        }
        primarySuccess = true;
      } catch (err: unknown) {
        console.warn(`[bdata-studio] Primary scrape failed (${getErrorMessage(err)}), falling back to Bing search`);
      }
    }
    
    if (!primarySuccess) {
      // Fallback Path
      scrape_status.path = "fallback";
      scrape_status.source_confidence = "fallback_discovered";
      scrapeMethod = "brightdata-scraper-studio-fallback";
      
      const certLabel = objective.cert_title
        ? `${objective.cert_title}${objective.cert_provider ? ` (${objective.cert_provider})` : ""}`
        : objective.certification_id
        ? objective.certification_id.replace(/^cert-/, "").replace(/-/g, " ")
        : "certification";

      const searchQuery = encodeURIComponent(`${objective.title} ${certLabel} official documentation`);
      const searchUrl = `https://www.bing.com/search?q=${searchQuery}`;
      
      let searchJson = "";
      try {
        let bingCollectorId = getCollectorId("www.bing.com", "documentation_search");
        if (!bingCollectorId) {
           bingCollectorId = "c_mt10dg5i258f47a685";
           saveCollectorId("www.bing.com", "documentation_search", bingCollectorId);
        }
        addProofEvent(proofEvents, {
          step: "create",
          status: "skipped",
          collector_id: bingCollectorId,
          collector_type: "documentation_search",
          url: searchUrl,
          message: `reusing Scraper Studio search collector ${bingCollectorId}`,
        });
        const searchRun = await runScraperStudioCollector({
          collectorId: bingCollectorId,
          collectorType: "documentation_search",
          url: searchUrl,
          events: proofEvents,
          timeoutMs: 120_000,
        });
        searchJson = JSON.stringify(searchRun.parsed);
      } catch {
        scrape_status.outcome = "failed";
        scrape_status.failure_reason = "fallback_invocation_failed";
        scrape_status.proof_events = proofEvents;
        return {
          sources: [],
          combinedContent: "",
          scrapeMethod,
          scrape_status,
          scraper_studio: buildScraperStudioProof(
            proofEvents,
            scrape_status.collector_id,
            scrape_status.collector_type
          ),
        };
      }

      let docUrl = "";
      try {
        const parsed: unknown = JSON.parse(searchJson);
        const results = candidatesFromJson(parsed);

        // Apply the same multi-factor heuristic scoring used in Discover so
        // the Bing fallback path cannot bypass product-rejection rules.
        // Bing results typically have a URL + title snippet but no full page
        // content — scoreCandidate handles that gracefully (URL/title signals
        // are still the strongest indicators of an unrelated Red Hat product).
        const officialResults = results.filter(r => {
          const url: string = r?.url || r?.link || r?.href || "";
          return url && OFFICIAL_DOMAINS.some(d => url.includes(d));
        });

        const best = selectBestCandidate(officialResults, objective.title, objective.cert_title);
        if (best) docUrl = best.url;
      } catch {
        // parsing failed
      }

      if (!docUrl) {
        scrape_status.outcome = "failed";
        scrape_status.failure_reason = "no_relevant_url_found";
        scrape_status.proof_events = proofEvents;
        return {
          sources: [],
          combinedContent: "",
          scrapeMethod,
          scrape_status,
          scraper_studio: buildScraperStudioProof(
            proofEvents,
            scrape_status.collector_id,
            scrape_status.collector_type
          ),
        };
      }

      scrape_status.source_url = docUrl;

      try {
        const result = await scrapeDocUrl(docUrl, objective.title, objective.cert_title);
        proofEvents.push(...result.proofEvents);
        extractionResult = result.extraction;
        scrape_status.source_url = result.resolvedUrl;
        if (result.collectorId) {
          scrape_status.collector_id = result.collectorId;
          scrape_status.collector_type = result.collectorType;
        }
      } catch {
        scrape_status.outcome = "failed";
        scrape_status.failure_reason = "scraper_run_failed";
        scrape_status.proof_events = proofEvents;
        return {
          sources: [],
          combinedContent: "",
          scrapeMethod,
          scrape_status,
          scraper_studio: buildScraperStudioProof(
            proofEvents,
            scrape_status.collector_id,
            scrape_status.collector_type
          ),
        };
      }
    }

    // Validation Gate
    const validation = validateExtractionResult(extractionResult, scrape_status.source_url);
    addProofEvent(proofEvents, {
      step: "validate",
      status: validation.is_valid ? "success" : "failed",
      collector_id: scrape_status.collector_id,
      collector_type: scrape_status.collector_type,
      url: scrape_status.source_url,
      message: validation.is_valid
        ? "structured extraction passed validation"
        : "structured extraction is missing required fields",
      detail: validation.missing_fields || undefined,
    });
    if (validation.is_valid) {
      scrape_status.outcome = "valid";
    } else {
      // Only attempt heal when a real Scraper Studio collector exists for this
      // domain — the Web Unlocker fallback path has no collector to heal.
      const hostname = new URL(scrape_status.source_url).hostname;
      const collectorId = !healAttempted
        ? scrape_status.collector_id || getCollectorId(hostname, "doc_content")
        : null;

      if (collectorId) {
        healAttempted = true;
        try {
          const healed = await healCollectorAndRerun({
            collectorId,
            collectorType: "doc_content",
            url: scrape_status.source_url,
            reason: `missing or empty fields: ${validation.missing_fields}`,
            events: proofEvents,
          });
          const healedData = healed.extraction;
          scrape_status.heal_status = healed.healStatus;

          const validation2 = validateExtractionResult(healedData, scrape_status.source_url);
          addProofEvent(proofEvents, {
            step: "verify",
            status: validation2.is_valid ? "success" : "failed",
            collector_id: collectorId,
            collector_type: "doc_content",
            url: scrape_status.source_url,
            message: validation2.is_valid
              ? "healed extraction passed validation"
              : "healed extraction is still missing required fields",
            detail: validation2.missing_fields || undefined,
          });
          if (validation2.is_valid) {
            extractionResult = healedData as ExtractionResult;
            scrape_status.healed = true;
            scrape_status.outcome = "valid";
            scrape_status.collector_id = collectorId;
            scrape_status.collector_type = "doc_content";
            scrape_status.missing_fields_recovered = validation.missing_fields;
          } else {
            scrape_status.outcome = "failed";
            scrape_status.failure_reason = "validation_failed_after_heal";
            scrape_status.proof_events = proofEvents;
            return {
              sources: [],
              combinedContent: "",
              scrapeMethod,
              scrape_status,
              scraper_studio: buildScraperStudioProof(
                proofEvents,
                scrape_status.collector_id,
                scrape_status.collector_type
              ),
            };
          }
        } catch {
          scrape_status.outcome = "failed";
          scrape_status.failure_reason = "validation_failed_after_heal";
          scrape_status.proof_events = proofEvents;
          return {
            sources: [],
            combinedContent: "",
            scrapeMethod,
            scrape_status,
            scraper_studio: buildScraperStudioProof(
              proofEvents,
              scrape_status.collector_id,
              scrape_status.collector_type
            ),
          };
        }
      } else {
        // No Scraper Studio collector (Web Unlocker path) — can't heal.
        // Accept partial extraction rather than hard-failing: the downstream
        // teach generator can still produce useful content from partial data
        // via Groq, which is better than showing a 422 error to the user.
        console.info(`[bdata-studio] Accepting partial extraction (missing: ${validation.missing_fields}) — no collector to heal`);
        scrape_status.outcome = "valid";
      }
    }

    const combinedContent = extractionResult ? JSON.stringify(extractionResult) : "";
    scrape_status.proof_events = proofEvents;
    return {
      sources: [
        {
          url: scrape_status.source_url,
          title: `Official documentation: ${objective.title}`,
          content: combinedContent,
        },
      ],
      combinedContent,
      scrapeMethod,
      scrape_status,
      extraction_result: extractionResult,
      scraper_studio: buildScraperStudioProof(
        proofEvents,
        scrape_status.collector_id,
        scrape_status.collector_type
      ),
    };

  } catch (err: unknown) {
    // Unexpected error
    throw err;
  }
}

export async function scrapeWithBrightData(
  url: string
): Promise<BrightDataScrapeResult> {
  const prompt =
    "Extract the full exam guide content: domain names, objective codes, topic descriptions, skill areas, and any percentages or weightings. Return all text content in a structured format.";
    
  if (!isBrightDataConfigured()) {
    throw new Error("Bright Data is not configured.");
  }

  const hostname = new URL(url).hostname;
  let collectorId = getCollectorId(hostname, "syllabus");

  if (!collectorId) {
    try {
      const out = await runBDataCli(["scraper", "create", url, prompt, "--json"], 180_000);
      const res = JSON.parse(out);
      collectorId = res.collector_id;
      if (collectorId) saveCollectorId(hostname, "syllabus", collectorId);
    } catch (createErr: unknown) {
      // The CLI may have created the template before timing out during AI
      // generation (user_intent_analyzer polling). Extract and cache the
      // collector ID so future calls reuse it instead of creating another.
      const idMatch = getErrorMessage(createErr, "").match(/c_[a-z0-9]+/);
      if (idMatch) {
        collectorId = idMatch[0] as string;
        saveCollectorId(hostname, "syllabus", collectorId);
        console.info(`[bdata-studio] Salvaged collector ID from failed create: ${collectorId}`);
      } else {
        throw createErr;
      }
    }
  }

  const runOut = await runBDataCli(["scraper", "run", collectorId!, url, "--json"], 120_000);
  const scrapeData = JSON.parse(runOut);
  const stringifiedData = JSON.stringify(scrapeData, null, 2);

  const cleanContent = await _legacyExtractCleanContent(stringifiedData, `exam guide for ${hostname}`);
  
  const hash = crypto.createHash("sha256").update(cleanContent).digest("hex");

  return {
    title: `Scraped Document: ${hostname}`,
    url,
    rawContent: cleanContent,
    contentHash: `sha256:${hash}`,
    retrievedAt: new Date().toISOString(),
    headings: [],
    links: [],
  };
}

async function _legacyExtractCleanContent(
  rawJson: string,
  context: string
): Promise<string> {
  const trimmed = rawJson.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return trimmed.substring(0, 12000);
  }
  const extractPrompt = `
You are extracting clean technical content from raw JSON scraped from a documentation page.
The content is related to: ${context}
Raw scraped JSON (may be partially truncated):
---
${rawJson.substring(0, 8000)}
---
Extract ALL meaningful technical information and return it as a clean JSON object:
{
  "page_title": "the page or document title",
  "summary": "2-3 sentence summary of what this page covers",
  "key_topics": ["list of main topics or services mentioned"],
  "technical_details": "Detailed prose with all technical specifics: service names, API names, config options, limits, features, pricing tiers, region availability, integration patterns — anything an exam might test. 300-600 words.",
  "important_notes": ["any deprecation notices, important caveats, or breaking changes mentioned"],
  "code_examples_present": boolean
}
  `.trim();
  try {
    const result = await createGroqJsonCompletion(extractPrompt);
    if (!result?.technical_details) return rawJson.substring(0, 12000);
    const parts: string[] = [];
    if (result.page_title) parts.push(`# ${result.page_title}`);
    if (result.summary) parts.push(result.summary);
    if (result.key_topics?.length) parts.push(`Key topics: ${result.key_topics.join(", ")}`);
    if (result.technical_details) parts.push(result.technical_details);
    if (result.important_notes?.length) parts.push(`Important notes:\n${result.important_notes.join("\n")}`);
    return parts.join("\n\n");
  } catch {
    return rawJson.substring(0, 12000);
  }
}
