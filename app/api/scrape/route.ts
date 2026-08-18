import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { saveScrapedSource, saveFreshnessAlert } from "@/lib/db/queries";
import { isBrightDataConfigured, scrapeWithBrightData } from "@/lib/ingestion/brightdata";

interface ScrapeResult {
  url: string;
  title: string;
  rawContent: string;
  contentHash: string;
  retrievedAt: string;
  scrapeMethod: string;
}

async function nativeScrape(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; DeltaBot/1.0; +https://delta.dev)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const html = await res.text();

  // Basic HTML-to-text: strip tags, collapse whitespace
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

  const hash = `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;

  return {
    url,
    title,
    rawContent: text,
    contentHash: hash,
    retrievedAt: new Date().toISOString(),
    scrapeMethod: "native-fetch",
  };
}

function detectFreshnessSignals(
  content: string,
  url: string
): { alertType: string; title: string; summary: string } | null {
  const lower = content.toLowerCase();

  const deprecatedSignals = [
    "luis.ai",
    "luis app",
    "qna maker",
    "form recognizer v2",
    "text analytics v3.0",
    "will be retired",
    "is being retired",
    "has been retired",
    "retirement notice",
  ];

  const updatedSignals = [
    "what's new",
    "whats new",
    "release notes",
    "updated on",
    "version 4.0",
    "api version 2024",
    "breaking change",
  ];

  for (const signal of deprecatedSignals) {
    if (lower.includes(signal)) {
      return {
        alertType: "deprecated",
        title: `Deprecated service reference detected: ${signal}`,
        summary: `The scraped page at ${url} references "${signal}" which may indicate deprecated content. Review this objective for accuracy.`,
      };
    }
  }

  for (const signal of updatedSignals) {
    if (lower.includes(signal)) {
      return {
        alertType: "updated",
        title: `Content update detected on ${new URL(url).hostname}`,
        summary: `The scraped page contains update signals ("${signal}"). Your prep material may need to be refreshed to reflect the latest guidance.`,
      };
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, objectiveId } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "url is required" },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: "invalid url" },
        { status: 400 }
      );
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { success: false, error: "only http/https urls are supported" },
        { status: 400 }
      );
    }

    let result: ScrapeResult;
    let usedBrightData = false;

    // Try Bright Data first if configured
    if (isBrightDataConfigured()) {
      try {
        const bdResult = await scrapeWithBrightData(url);
        result = {
          url: bdResult.url,
          title: bdResult.title,
          rawContent: bdResult.rawContent,
          contentHash: bdResult.contentHash,
          retrievedAt: bdResult.retrievedAt,
          scrapeMethod: "brightdata-cdp",
        };
        usedBrightData = true;
        console.info(`[scrape] successfully scraped via Bright Data CDP: ${url}`);
      } catch (bdErr: any) {
        console.warn(
          `[scrape] Bright Data failed (${bdErr?.message}), falling back to native fetch`
        );
        result = await nativeScrape(url);
        console.info(`[scrape] [self-heal] recovered via native fetch: ${url}`);
      }
    } else {
      result = await nativeScrape(url);
    }

    // Persist to DB
    const sourceId = `src-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    saveScrapedSource({
      id: sourceId,
      url: result.url,
      title: result.title,
      rawContent: result.rawContent,
      contentHash: result.contentHash,
      scrapeMethod: result.scrapeMethod,
      status: "success",
      objectiveId: objectiveId || undefined,
    });

    // Detect freshness signals and create alerts
    const signal = detectFreshnessSignals(result.rawContent, url);
    if (signal && objectiveId) {
      const alertId = `alert-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      saveFreshnessAlert({
        id: alertId,
        objectiveId,
        alertType: signal.alertType,
        title: signal.title,
        summary: signal.summary,
        sourceUrl: url,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: sourceId,
        url: result.url,
        title: result.title,
        rawContent: result.rawContent,
        contentHash: result.contentHash,
        retrievedAt: result.retrievedAt,
        scrapeMethod: result.scrapeMethod,
        usedBrightData,
        freshnessSignal: signal,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
