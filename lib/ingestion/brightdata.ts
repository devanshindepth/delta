import { chromium } from "playwright";
import crypto from "crypto";

export interface BrightDataScrapeResult {
  title: string;
  url: string;
  rawContent: string;
  contentHash: string;
  retrievedAt: string;
  headings: string[];
  links: string[];
}

export interface ObjectiveScrapeResult {
  sources: Array<{
    url: string;
    title: string;
    content: string;
  }>;
  combinedContent: string;
  scrapeMethod: string;
}

/**
 * Checks whether Bright Data credentials are configured in the environment.
 */
export function isBrightDataConfigured(): boolean {
  const ws = process.env.BRIGHT_DATA_WS_ENDPOINT;
  const apiKey = process.env.BRIGHT_DATA_API_KEY;
  return Boolean(
    (ws && ws.trim() !== "" && !ws.includes("dummy")) ||
    (apiKey && apiKey.trim() !== "" && !apiKey.includes("your_bright_data_api_key"))
  );
}

/**
 * Bright Data Web Scraper — EXCLUSIVE scraper.
 * Communicates with Bright Data Scraping Browser via CDP (Chrome DevTools Protocol)
 * or Bright Data Web Unlocker / Scraping API.
 * 
 * ZERO non-BrightData fallback is permitted.
 */
export async function scrapeWithBrightData(url: string): Promise<BrightDataScrapeResult> {
  const wsEndpoint = process.env.BRIGHT_DATA_WS_ENDPOINT;
  const apiKey = process.env.BRIGHT_DATA_API_KEY;

  if (!isBrightDataConfigured()) {
    throw new Error(
      "Bright Data is not configured. Please set BRIGHT_DATA_WS_ENDPOINT (Bright Data Scraping Browser WebSocket) or BRIGHT_DATA_API_KEY in your .env.local file. As per project specification, only Bright Data scraping is enabled."
    );
  }

  // Strategy 1: Bright Data Scraping Browser via Playwright CDP
  if (wsEndpoint && wsEndpoint.trim() !== "") {
    let browser: any = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const scrapePromise = (async () => {
        console.info(`[brightdata] connecting to Scraping Browser for: ${url}`);
        browser = await chromium.connectOverCDP(wsEndpoint);
        const context = browser.contexts()[0] || (await browser.newContext());
        const page = await context.newPage();

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

        const title = (await page.title()) || "Untitled Document";

        // Extract structured text and clean unnecessary artifacts
        const pageData = await page.evaluate(() => {
          const scripts = document.querySelectorAll("script, style, nav, footer, noscript, iframe");
          scripts.forEach((el) => el.remove());

          const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4"))
            .map((h) => (h.textContent || "").trim())
            .filter(Boolean);

          const links = Array.from(document.querySelectorAll("a[href]"))
            .map((a) => (a as HTMLAnchorElement).href)
            .filter((h) => h.startsWith("http"));

          const bodyText = document.body ? document.body.innerText.replace(/\s+/g, " ").trim() : "";

          return {
            bodyText,
            headings,
            links: Array.from(new Set(links)).slice(0, 50)
          };
        });

        const hash = crypto.createHash("sha256").update(pageData.bodyText).digest("hex");

        return {
          title,
          url,
          rawContent: pageData.bodyText,
          contentHash: `sha256:${hash}`,
          retrievedAt: new Date().toISOString(),
          headings: pageData.headings,
          links: pageData.links
        };
      })();

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Bright Data Scraping Browser CDP session timed out after 45s."));
        }, 45000);
      });

      return await Promise.race([scrapePromise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (browser) {
        try {
          await browser.close();
        } catch {
          // ignore close error
        }
      }
    }
  }

  // Strategy 2: Bright Data Web Unlocker / Scraping API via HTTPS Request
  if (apiKey && apiKey.trim() !== "") {
    console.info(`[brightdata] calling Bright Data Web Unlocker API for: ${url}`);
    const endpoint = "https://api.brightdata.com/request";
    
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url,
        format: "raw",
        zone: process.env.BRIGHT_DATA_ZONE || "unblocker"
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Bright Data Scraping API returned status ${res.status}: ${errText}`);
    }

    const html = await res.text();
    // Clean and extract basic text
    const cleanText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const hash = crypto.createHash("sha256").update(cleanText).digest("hex");

    return {
      title: `Scraped Document: ${new URL(url).hostname}`,
      url,
      rawContent: cleanText,
      contentHash: `sha256:${hash}`,
      retrievedAt: new Date().toISOString(),
      headings: [],
      links: []
    };
  }

  throw new Error("No valid Bright Data scraping endpoint configured.");
}

/**
 * Build a list of candidate documentation URLs for a given certification objective.
 * Prioritises official vendor docs over generic searches.
 */
function buildDocUrls(objective: {
  title: string;
  description?: string;
  certification_id?: string;
  domain_title?: string;
}): string[] {
  const title = objective.title || "";
  const certId = (objective.certification_id || "").toLowerCase();
  const encoded = encodeURIComponent(`${title} ${objective.domain_title || ""} documentation`);

  const urls: string[] = [];

  // Provider-specific doc roots
  if (certId.includes("azure") || certId.includes("az-") || certId.includes("ai-") || certId.includes("ms-")) {
    urls.push(`https://learn.microsoft.com/en-us/search/?terms=${encodeURIComponent(title)}&category=Documentation`);
    urls.push(`https://learn.microsoft.com/en-us/azure/`);
  } else if (certId.includes("aws") || certId.includes("saa") || certId.includes("amazon")) {
    urls.push(`https://docs.aws.amazon.com/index.html`);
    urls.push(`https://aws.amazon.com/search/?searchQuery=${encodeURIComponent(title)}`);
  } else if (certId.includes("gcp") || certId.includes("google") || certId.includes("gce")) {
    urls.push(`https://cloud.google.com/docs`);
    urls.push(`https://cloud.google.com/docs/search?q=${encodeURIComponent(title)}`);
  } else if (certId.includes("cka") || certId.includes("kubernetes") || certId.includes("k8s")) {
    urls.push(`https://kubernetes.io/docs/search/?q=${encodeURIComponent(title)}`);
  }

  // Fallback: Bing search (reliably returns HTML with relevant excerpts)
  urls.push(`https://www.bing.com/search?q=${encoded}+site:docs.microsoft.com+OR+site:docs.aws.amazon.com+OR+site:cloud.google.com+OR+site:kubernetes.io`);
  urls.push(`https://www.bing.com/search?q=${encoded}`);

  return urls;
}

/**
 * Scrape real course/documentation content for a certification objective using
 * Bright Data Web Unlocker. Returns extracted text from the best available source.
 *
 * Falls back gracefully when Bright Data is not configured.
 */
export async function scrapeObjectiveContent(objective: {
  id?: string;
  title: string;
  description?: string;
  certification_id?: string;
  domain_title?: string;
  objective_code?: string;
}): Promise<ObjectiveScrapeResult> {
  const apiKey = process.env.BRIGHT_DATA_API_KEY;
  const zone = process.env.BRIGHT_DATA_ZONE || "web_unlocker1";

  const fallbackResult: ObjectiveScrapeResult = {
    sources: [],
    combinedContent: "",
    scrapeMethod: "none",
  };

  if (!apiKey || apiKey.trim() === "" || apiKey.includes("your_bright_data_api_key")) {
    console.info("[brightdata] API key not configured — skipping objective scrape");
    return fallbackResult;
  }

  const candidateUrls = buildDocUrls(objective);
  const sources: Array<{ url: string; title: string; content: string }> = [];

  // Try up to 2 URLs — we want real content, not just a search results page
  for (const url of candidateUrls.slice(0, 3)) {
    if (sources.length >= 2) break;

    try {
      console.info(`[brightdata] scraping objective content from: ${url}`);

      const res = await fetch("https://api.brightdata.com/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url,
          zone,
          format: "raw",
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.warn(`[brightdata] Web Unlocker returned ${res.status} for ${url}`);
        continue;
      }

      const html = await res.text();
      if (!html || html.length < 200) continue;

      // Extract meaningful text — strip scripts, styles, nav chrome
      const cleanText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s{3,}/g, "\n\n")
        .trim();

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

      // Only keep pages that seem to contain relevant content
      const lowerText = cleanText.toLowerCase();
      const objTitleWords = objective.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const relevantWordCount = objTitleWords.filter((w) => lowerText.includes(w)).length;

      // Accept if at least half the key words from the objective appear on the page
      if (relevantWordCount >= Math.ceil(objTitleWords.length * 0.4)) {
        sources.push({
          url,
          title,
          // Cap content per source to avoid flooding the LLM context
          content: cleanText.substring(0, 6000),
        });
        console.info(`[brightdata] accepted content from ${url} (${relevantWordCount}/${objTitleWords.length} key terms matched)`);
      } else {
        console.info(`[brightdata] skipped low-relevance page ${url} (${relevantWordCount}/${objTitleWords.length} key terms)`);
      }
    } catch (err: any) {
      console.warn(`[brightdata] failed to scrape ${url}: ${err?.message}`);
    }
  }

  if (sources.length === 0) {
    return fallbackResult;
  }

  const combinedContent = sources
    .map((s) => `## Source: ${s.title}\nURL: ${s.url}\n\n${s.content}`)
    .join("\n\n---\n\n");

  return {
    sources,
    combinedContent,
    scrapeMethod: "brightdata-web-unlocker",
  };
}
