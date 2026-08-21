import { NextResponse } from "next/server";
import {
  getObjectiveById,
  getCertificationById,
  saveScrapedSource,
  getRecentScrapedSourceForObjective,
} from "@/lib/db/queries";
import { isGroqConfigured, createGroqJsonCompletion } from "@/lib/groq";
import {
  scrapeObjectiveContent,
  isBrightDataConfigured,
  ExtractionResult,
} from "@/lib/ingestion/brightdata";
import crypto from "crypto";

export const maxDuration = 300;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const objective = getObjectiveById(id);
    if (!objective) {
      return NextResponse.json(
        { success: false, error: "Objective not found" },
        { status: 404 }
      );
    }

    const cert = getCertificationById(objective.certification_id);

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    const force = url.searchParams.get("force") === "true";

    // ── 1. Check DB Cache First (Only scrape if cache missing or force=true) ──
    const cached = !force ? getRecentScrapedSourceForObjective(objective.id, 168) : null; // 7 days cache
    if (cached?.raw_content) {
      let cachedExtraction: ExtractionResult | null = null;
      try {
        const parsed = JSON.parse(cached.raw_content);
        if (parsed && (parsed.title || parsed.key_concepts?.length)) {
          cachedExtraction = parsed;
        }
      } catch {
        // Not JSON
      }

      if (cachedExtraction) {
        if (!isGroqConfigured()) {
          return NextResponse.json({
            success: true,
            persisted: true,
            cached: true,
          });
        }

        const content = await generateTeachContent(
          objective,
          cachedExtraction,
          cached.url || "Cached Official Documentation",
          mode === "reteach"
        );

        return NextResponse.json({
          success: true,
          data: {
            ...content,
            sources_used: `Bright Data Scraper Studio — ${cached.url}`,
          },
          scrape_status: {
            path: "primary",
            source_confidence: "official_blueprint",
            source_label: "Official source (cached)",
            healed: false,
            outcome: "valid",
            source_url: cached.url,
          },
        });
      }
    }

    // ── 2. Run Scrape if no valid cached content exists ─────────────────────
    const scrapeResult = await scrapeObjectiveContent({
      id: objective.id,
      title: objective.title,
      description: objective.description,
      certification_id: objective.certification_id,
      domain_title: objective.domain_title,
      objective_code: objective.objective_code,
      cert_title: cert?.title,
      cert_provider: cert?.provider,
      skills: objective.skills,
    });

    if (!scrapeResult.scrape_status) {
       return NextResponse.json(
         { 
           success: false, 
           error: "extraction_failed", 
           reason: "missing_scrape_metadata", 
           user_message: "An internal error occurred while verifying the source. Please try again.",
         },
         { status: 422 }
       );
    }

    if (scrapeResult.scrape_status.outcome === "failed") {
      const reason = scrapeResult.scrape_status?.failure_reason || "missing_scrape_metadata";
      
      const userMessageMap: Record<string, string> = {
        no_official_url_found: "We couldn't find official documentation for this topic right now.",
        fallback_invocation_failed: "We couldn't reach the documentation source right now. Please try again.",
        validation_failed_after_heal: "We found the source but couldn't extract the required information, even after an automatic repair attempt.",
        scraper_run_failed: "We couldn't retrieve the documentation page right now. Please try again.",
        missing_scrape_metadata: "An internal error occurred while verifying the source. Please try again.",
      };
      
      return NextResponse.json(
        {
          success: false,
          error: "extraction_failed",
          reason,
          user_message: userMessageMap[reason] || userMessageMap.missing_scrape_metadata,
          scrape_status: scrapeResult.scrape_status,
        },
        { status: 422 }
      );
    }

    // Persist source
    for (const src of scrapeResult.sources) {
      const sourceId = `src-teach-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      saveScrapedSource({
        id: sourceId,
        url: src.url,
        title: src.title,
        rawContent: src.content,
        contentHash: `sha256:${crypto.createHash("sha256").update(src.content).digest("hex")}`,
        scrapeMethod: scrapeResult.scrapeMethod,
        status: "success",
        objectiveId: objective.id,
      });
    }

    if (!isGroqConfigured()) {
      return NextResponse.json({
        success: true,
        persisted: true,
        scrape_status: scrapeResult.scrape_status
      });
    }

    const content = await generateTeachContent(
      objective, 
      scrapeResult.extraction_result!, 
      scrapeResult.scrape_status.source_url,
      mode === "reteach"
    );

    const sourceConfidenceMap: Record<string, string> = {
      official_blueprint: "Official source",
      provider_derived: "Official-domain source discovered automatically",
      fallback_discovered: "Official-domain source discovered via search"
    };

    const responseData: any = {
      success: true,
      data: {
        ...content,
        sources_used: `Bright Data Scraper Studio — ${scrapeResult.scrape_status.source_url}`,
      },
      scrape_status: {
        ...scrapeResult.scrape_status,
        source_label: sourceConfidenceMap[scrapeResult.scrape_status.source_confidence] || "Official source",
      },
    };

    if (scrapeResult.scrape_status.healed) {
      responseData.heal_badge = `[~] scraper healed — missing ${scrapeResult.scrape_status.missing_fields_recovered || 'fields'} recovered`;
    }
    
    if (scrapeResult.scrape_status.path === "fallback") {
      responseData.source_note = "Content URL discovered via Bing search; page scraped directly by Bright Data.";
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("[teach] route error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function generateTeachContent(
  objective: any,
  extraction: ExtractionResult,
  sourceUrl: string,
  isReteach: boolean = false
) {
  const formatField = (field: any) => {
    if (Array.isArray(field) && field.length === 0) return "null";
    if (!field) return "null";
    return JSON.stringify(field, null, 2);
  };

  const scrapingSection = `
REAL COURSE MATERIAL (scraped from official documentation — use this as your ONLY source of truth):
---
title: ${formatField(extraction.title)}
summary: ${formatField(extraction.summary)}
learning_outcomes: ${formatField(extraction.learning_outcomes)}
key_concepts: ${formatField(extraction.key_concepts)}
api_names: ${formatField(extraction.api_names)}
limits: ${formatField(extraction.limits)}
code_examples: ${formatField(extraction.code_examples)}
---

GROUNDED GENERATION RULES:
- Base your teaching ONLY on the real documentation provided above.
- Extract actual facts, terminology, commands, parameters, and limits from the extracted evidence.
- Do NOT hallucinate or use external general knowledge to fill in gaps.
- If a detail is absent in the source material, omit it rather than inventing it.
`;

  const reteachInstruction = isReteach ? 
    "This is a RETEACH session because the learner previously struggled with a practice question on this topic. Emphasize the common_mistakes and exam_tip fields to specifically address misconceptions." : "";

  const prompt = `You are an expert technical instructor teaching a developer preparing for the ${
    objective.certification_id || "cloud"
  } certification exam.

Your job is to TEACH the following exam objective from first principles using clean, structured, informative bullet points. Do NOT write dense paragraph walls.
${scrapingSection}

${reteachInstruction}

Exam Objective: ${objective.objective_code || ""}. ${objective.title}
Domain: ${objective.domain_title || ""}
Description: ${objective.description || ""}

FORMATTING REQUIREMENTS:
- Use concise, high-signal bullet points. Each bullet should be 1-2 clear, punchy sentences explaining a specific fact or mechanism.
- Avoid conversational filler phrases like "it is important to understand" or "in this section we will".
- Highlight concrete specifics from docs (service names, config options, limits, APIs).

Return ONLY valid JSON with this exact structure:
{
  "what_it_is": [
    "First core definition bullet point grounded in real documentation.",
    "Second key characteristic or architectural role."
  ],
  "analogy": "One concrete real-world analogy or mental model (1-2 sentences)",
  "why_it_exists": [
    "The primary problem this architecture/service was created to solve.",
    "The operational or business benefit over traditional approaches."
  ],
  "how_it_works": [
    "Step 1 or primary operational mechanism (e.g. provisioning, configuration).",
    "Step 2 or runtime interaction (e.g. CLI commands, SDK calls, authentication).",
    "Step 3 or lifecycle/scaling/storage behavior from documentation."
  ],
  "key_concepts": [
    {"term": "technical term from docs", "definition": "plain 1-sentence technical definition based on docs"}
  ],
  "common_mistakes": [
    "First specific misconception or exam trap (e.g. confusing tier vs region limits).",
    "Second common mistake tested on the exam."
  ],
  "exam_tip": "The single most critical takeaway or tradeoff decision rule for the exam (1-2 sentences)."
}`;

  const rawResult = await createGroqJsonCompletion(prompt);
  
  // Normalize string outputs to arrays if LLM returned strings
  const normalizeToArray = (val: any): string[] => {
    if (Array.isArray(val)) {
      return val.map((s) => String(s).trim()).filter(Boolean);
    }
    if (typeof val === "string" && val.trim()) {
      return val
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);
    }
    return [];
  };

  return {
    what_it_is: normalizeToArray(rawResult.what_it_is),
    analogy: typeof rawResult.analogy === "string" ? rawResult.analogy.trim() : "",
    why_it_exists: normalizeToArray(rawResult.why_it_exists),
    how_it_works: normalizeToArray(rawResult.how_it_works),
    key_concepts: Array.isArray(rawResult.key_concepts) ? rawResult.key_concepts : [],
    common_mistakes: normalizeToArray(rawResult.common_mistakes),
    exam_tip: typeof rawResult.exam_tip === "string" ? rawResult.exam_tip.trim() : "",
  };
}
