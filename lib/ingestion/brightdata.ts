import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createGroqJsonCompletion } from "@/lib/groq";

const execFileAsync = promisify(execFile);

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
  failure_reason?: string;
  missing_fields_recovered?: string;
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

  console.info(`[bdata-studio] Running: bdata ${args.slice(0, 2).join(" ")}`);

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
  } catch (err: any) {
    const msg = err?.stderr
      ? String(err.stderr).substring(0, 300)
      : err?.message || "unknown CLI error";
    throw new Error(`[bdata-studio] CLI failed: ${msg}`);
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
        } catch (e) {
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
  return `Extract the following documentation page content as a JSON object strictly matching this canonical schema:
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

export function normalizeExtractionResult(raw: any): ExtractionResult {
  if (!raw || typeof raw !== "object") {
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
  const title = typeof raw.title === "string" && raw.title.trim()
    ? raw.title.trim()
    : typeof raw.page_title === "string" && raw.page_title.trim()
    ? raw.page_title.trim()
    : typeof raw.name === "string" && raw.name.trim()
    ? raw.name.trim()
    : "";

  const summary = typeof raw.summary === "string" && raw.summary.trim()
    ? raw.summary.trim()
    : typeof raw.overview === "string" && raw.overview.trim()
    ? raw.overview.trim()
    : typeof raw.description === "string" && raw.description.trim()
    ? raw.description.trim()
    : "";

  // 2. Learning Outcomes
  const learning_outcomes: string[] = [];
  if (Array.isArray(raw.learning_outcomes)) {
    for (const item of raw.learning_outcomes) {
      if (typeof item === "string" && item.trim()) learning_outcomes.push(item.trim());
    }
  } else if (Array.isArray(raw.learning_objectives)) {
    for (const item of raw.learning_objectives) {
      if (typeof item === "string" && item.trim()) learning_outcomes.push(item.trim());
    }
  } else if (Array.isArray(raw.outcomes)) {
    for (const item of raw.outcomes) {
      if (typeof item === "string" && item.trim()) learning_outcomes.push(item.trim());
    }
  }

  if (learning_outcomes.length === 0) {
    if (typeof raw.introduction === "string" && raw.introduction.trim()) {
      learning_outcomes.push(raw.introduction.trim());
    }
    if (typeof raw.prerequisites === "string" && raw.prerequisites.trim()) {
      learning_outcomes.push(raw.prerequisites.trim());
    }
  }

  // 3. Key Concepts
  let key_concepts: Array<{ term: string; definition: string }> = [];
  if (Array.isArray(raw.key_concepts)) {
    for (const kc of raw.key_concepts) {
      if (kc && typeof kc === "object") {
        const term = String(kc.term || kc.name || kc.concept || "").trim();
        const definition = String(kc.definition || kc.description || kc.meaning || kc.summary || "").trim();
        if (term && definition) {
          key_concepts.push({ term, definition });
        }
      }
    }
  }

  // If key_concepts is empty, inspect semantic collections: topics, concepts, components, definitions
  if (key_concepts.length === 0) {
    const candidateList = Array.isArray(raw.topics)
      ? raw.topics
      : Array.isArray(raw.concepts)
      ? raw.concepts
      : Array.isArray(raw.components)
      ? raw.components
      : Array.isArray(raw.definitions)
      ? raw.definitions
      : Array.isArray(raw.key_topics)
      ? raw.key_topics
      : null;

    if (candidateList && candidateList.length > 0) {
      for (const item of candidateList) {
        if (typeof item === "string" && item.trim()) {
          key_concepts.push({
            term: item.trim(),
            definition: `Core technical topic described in ${title || "the documentation"}.`,
          });
        } else if (item && typeof item === "object") {
          const term = String(item.topic_title || item.title || item.name || item.term || "").trim();
          const definition = String(item.description || item.summary || item.definition || `Technical concept covered in ${title || "documentation"}.`).trim();
          if (term) {
            key_concepts.push({ term, definition });
          }
        }
      }
    }
  }

  // If still empty, parse HTML tables or headings from raw.content if present
  if (key_concepts.length === 0 && raw.content) {
    const content = String(raw.content);

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
  const api_names: string[] = [];
  const rawApis = Array.isArray(raw.api_names) ? raw.api_names : (Array.isArray(raw.apis) ? raw.apis : (Array.isArray(raw.cli_commands) ? raw.cli_commands : []));
  for (const item of rawApis) {
    if (typeof item === "string" && item.trim()) api_names.push(item.trim());
  }

  const limits: string[] = [];
  const rawLimits = Array.isArray(raw.limits) ? raw.limits : (Array.isArray(raw.quotas) ? raw.quotas : (Array.isArray(raw.constraints) ? raw.constraints : []));
  for (const item of rawLimits) {
    if (typeof item === "string" && item.trim()) limits.push(item.trim());
  }

  const code_examples: string[] = [];
  const rawCode = Array.isArray(raw.code_examples) ? raw.code_examples : (Array.isArray(raw.code_samples) ? raw.code_samples : (Array.isArray(raw.snippets) ? raw.snippets : []));
  for (const item of rawCode) {
    if (typeof item === "string" && item.trim()) code_examples.push(item.trim());
  }

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
  const query = certTitle
    ? `${objectiveTitle} ${certTitle}`
    : objectiveTitle;

  const intent = `Find the official ${domain} documentation page that best explains: ${objectiveTitle}. Prefer deep technical reference pages over search results or index pages.`;

  console.info(`[bdata-studio] Discovering doc for: ${query} on ${domain}`);

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
  } catch (err: any) {
    console.warn(`[bdata-studio] discover failed: ${err.message}`);
    return null;
  }

  if (!out || out.trim().length < 10) return null;

  try {
    const parsed = JSON.parse(out);
    const results: any[] = Array.isArray(parsed)
      ? parsed
      : parsed.results || parsed.items || parsed.data || [];

    for (const r of results) {
      const url: string = r?.url || r?.link || r?.href || "";
      const content: string = r?.content || r?.markdown || r?.text || r?.body || "";
      if (
        url &&
        url.includes(domain) &&
        !url.includes("/search") &&
        !url.includes("?q=") &&
        content.trim().length > 200
      ) {
        console.info(`[bdata-studio] Found doc via discover: ${url}`);
        return { url, content };
      }
    }
  } catch {
    console.warn(`[bdata-studio] Could not parse discover results (first 300 chars): ${out.substring(0, 300)}`);
  }
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
    const parsed = JSON.parse(out);
    if (parsed && typeof parsed.content === "string" && parsed.content.trim().length > 50) {
      return parsed.content;
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
): Promise<{ extraction: ExtractionResult; resolvedUrl: string }> {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;
  const collectorId = getCollectorId(hostname, "doc_content");

  if (collectorId) {
    // Happy path: domain has a trained Scraper Studio collector
    console.info(`[bdata-studio] Running collector ${collectorId} for ${hostname}`);
    const runOut = await runBDataCli(["scraper", "run", collectorId, url, "--json"], 120_000);
    let scrapeData: any;
    try {
      scrapeData = JSON.parse(runOut);
      if (Array.isArray(scrapeData)) scrapeData = scrapeData[0] || {};
    } catch {
      throw new Error(`scraper_run_failed`);
    }
    return { extraction: normalizeExtractionResult(scrapeData), resolvedUrl: url };
  }

  // No Scraper Studio collector — use brightdata discover to find + fetch content
  console.info(`[bdata-studio] No collector for ${hostname} — using discover + Groq extraction`);

  const discovered = await discoverDocContent(objectiveTitle, hostname, certTitle);

  if (discovered) {
    // Got content directly from discover — skip the separate scrape call
    const extraction = await extractFromRawContent(discovered.content, objectiveTitle, discovered.url);
    return { extraction, resolvedUrl: discovered.url };
  }

  // discover found nothing — fall back to scraping the original URL directly
  // (works for non-SPA pages; may return sparse content for SPA search pages)
  console.info(`[bdata-studio] discover found nothing, scraping ${url} directly`);
  const rawContent = await fetchWithWebUnlocker(url);
  const extraction = await extractFromRawContent(rawContent, objectiveTitle, url);
  return { extraction, resolvedUrl: url };
}

export async function scrapeObjectiveContent(
  objective: ScrapeObjectiveInput
): Promise<ObjectiveScrapeResult> {
  if (!isBrightDataConfigured()) {
    throw new Error("Bright Data is not configured.");
  }

  let scrape_status: ScrapeStatus = {
    path: "primary",
    source_confidence: "official_blueprint",
    healed: false,
    outcome: "failed",
    source_url: "",
  };
  
  let extractionResult: ExtractionResult | undefined;
  let scrapeMethod = "";
  let healAttempted = false;

  try {
    const resolved = resolveOfficialUrl(objective);
    
    if (resolved) {
      scrape_status.path = "primary";
      scrape_status.source_confidence = resolved.source_confidence;
      scrape_status.source_url = resolved.url;
      scrapeMethod = "brightdata-scraper-studio-primary";
      
      try {
        const result = await scrapeDocUrl(resolved.url, objective.title, objective.cert_title);
        extractionResult = result.extraction;
        // Update source_url to the actual page scraped (may differ from search URL)
        scrape_status.source_url = result.resolvedUrl;
      } catch (err: any) {
        scrape_status.outcome = "failed";
        scrape_status.failure_reason = "scraper_run_failed";
        return {
          sources: [],
          combinedContent: "",
          scrapeMethod,
          scrape_status
        };
      }
    } else {
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
        searchJson = await runBDataCli(["scraper", "run", bingCollectorId, searchUrl, "--json"], 120_000);
      } catch (err: any) {
        scrape_status.outcome = "failed";
        scrape_status.failure_reason = "fallback_invocation_failed";
        return { sources: [], combinedContent: "", scrapeMethod, scrape_status };
      }

      let docUrl = "";
      try {
        const parsed = JSON.parse(searchJson);
        const results: any[] = Array.isArray(parsed) ? parsed : parsed.results || parsed.items || parsed.data || [];
        for (const r of results) {
          const url: string = r?.url || r?.link || r?.href || "";
          if (url && OFFICIAL_DOMAINS.some(d => url.includes(d))) {
            docUrl = url;
            break;
          }
        }
      } catch (e) {
        // parsing failed
      }

      if (!docUrl) {
        scrape_status.outcome = "failed";
        scrape_status.failure_reason = "no_official_url_found";
        return { sources: [], combinedContent: "", scrapeMethod, scrape_status };
      }

      scrape_status.source_url = docUrl;

      try {
        const result = await scrapeDocUrl(docUrl, objective.title, objective.cert_title);
        extractionResult = result.extraction;
        scrape_status.source_url = result.resolvedUrl;
      } catch (err: any) {
        scrape_status.outcome = "failed";
        scrape_status.failure_reason = "scraper_run_failed";
        return { sources: [], combinedContent: "", scrapeMethod, scrape_status };
      }
    }

    // Validation Gate
    let validation = validateExtractionResult(extractionResult, scrape_status.source_url);
    if (validation.is_valid) {
      scrape_status.outcome = "valid";
    } else {
      // Only attempt heal when a real Scraper Studio collector exists for this
      // domain — the Web Unlocker fallback path has no collector to heal.
      const hostname = new URL(scrape_status.source_url).hostname;
      const collectorId = !healAttempted ? getCollectorId(hostname, "doc_content") : null;

      if (collectorId) {
        healAttempted = true;
        try {
          // Use --auto-approve: the correct unattended heal pattern per Bright Data
          // docs. Runs heal + approve atomically without a manual review gate.
          const healPrompt = `The following fields are missing or empty. Please extract them: ${validation.missing_fields}`;
          const healOut = await runBDataCli(
            ["scraper", "heal", collectorId, healPrompt, "--auto-approve", "--json"],
            180_000
          );

          // After heal+approve, run the scraper again to get updated data
          const runOut = await runBDataCli(
            ["scraper", "run", collectorId, scrape_status.source_url, "--json"],
            120_000
          );
          let rawHealedData = JSON.parse(runOut);
          if (Array.isArray(rawHealedData)) rawHealedData = rawHealedData[0] || {};
          const healedData = normalizeExtractionResult(rawHealedData);

          const validation2 = validateExtractionResult(healedData, scrape_status.source_url);
          if (validation2.is_valid) {
            extractionResult = healedData as ExtractionResult;
            scrape_status.healed = true;
            scrape_status.outcome = "valid";
            scrape_status.missing_fields_recovered = validation.missing_fields;
          } else {
            scrape_status.outcome = "failed";
            scrape_status.failure_reason = "validation_failed_after_heal";
            return { sources: [], combinedContent: "", scrapeMethod, scrape_status };
          }
        } catch (e) {
          scrape_status.outcome = "failed";
          scrape_status.failure_reason = "validation_failed_after_heal";
          return { sources: [], combinedContent: "", scrapeMethod, scrape_status };
        }
      } else {
        // No Scraper Studio collector (Web Unlocker path) — can't heal without
        // a collector, so treat validation failure as a scrape failure so the
        // caller can surface a meaningful retry message.
        scrape_status.outcome = "failed";
        scrape_status.failure_reason = "scraper_run_failed";
        return { sources: [], combinedContent: "", scrapeMethod, scrape_status };
      }
    }

    const combinedContent = extractionResult ? JSON.stringify(extractionResult) : "";
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
      extraction_result: extractionResult
    };

  } catch (err: any) {
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
    const out = await runBDataCli(["scraper", "create", url, prompt, "--json"], 180_000);
    const res = JSON.parse(out);
    collectorId = res.collector_id;
    if (collectorId) saveCollectorId(hostname, "syllabus", collectorId);
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
