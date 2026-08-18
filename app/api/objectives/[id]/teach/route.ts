import { NextResponse } from "next/server";
import { getObjectiveById, saveScrapedSource } from "@/lib/db/queries";
import { isGroqConfigured, createGroqJsonCompletion } from "@/lib/groq";
import { scrapeObjectiveContent, isBrightDataConfigured } from "@/lib/ingestion/brightdata";
import crypto from "crypto";

// In-memory cache to avoid re-generating identical content
const cache = new Map<string, any>();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (cache.has(id)) {
      return NextResponse.json({ success: true, data: cache.get(id) });
    }

    const objective = getObjectiveById(id);
    if (!objective) {
      return NextResponse.json({ success: false, error: "Objective not found" }, { status: 404 });
    }

    if (!isGroqConfigured()) {
      const fallback = buildFallbackTeachContent(objective);
      return NextResponse.json({ success: true, data: fallback });
    }

    // Scrape real course/documentation content from the web using Bright Data
    let scrapedMaterial = "";
    if (isBrightDataConfigured()) {
      try {
        const scrapeResult = await scrapeObjectiveContent({
          id: objective.id,
          title: objective.title,
          description: objective.description,
          certification_id: objective.certification_id,
          domain_title: objective.domain_title,
          objective_code: objective.objective_code,
        });

        if (scrapeResult.combinedContent) {
          scrapedMaterial = scrapeResult.combinedContent;

          // Persist each scraped source so it appears in the sources panel
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

          console.info(
            `[teach] grounded objective "${objective.title}" with ${scrapeResult.sources.length} scraped source(s) via ${scrapeResult.scrapeMethod}`
          );
        }
      } catch (scrapeErr: any) {
        // Non-fatal — fall through to LLM-only generation
        console.warn(`[teach] Bright Data scrape failed for "${objective.title}": ${scrapeErr?.message}`);
      }
    }

    const content = await generateTeachContent(objective, scrapedMaterial);
    cache.set(id, content);
    return NextResponse.json({ success: true, data: content });
  } catch (error: any) {
    console.error("[teach] route error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function buildFallbackTeachContent(objective: any) {
  return {
    what_it_is: objective.description,
    why_it_matters: `This topic accounts for a portion of the ${objective.domain_title || 'exam'} domain and frequently appears in exam scenarios. Understanding it well directly improves your readiness score.`,
    key_concepts: [
      { term: objective.title, definition: objective.description },
    ],
    how_it_works: `${objective.title} is a core component of the exam. Review the official documentation to understand the configuration options, limits, and integration patterns that exam questions typically test.`,
    common_mistakes: [
      "Confusing this service with a similar one that solves a different problem",
      "Overlooking default limits and quotas that affect architectural decisions",
      "Missing the difference between sync and async variants where applicable",
    ],
    exam_tip: `On the exam, questions about ${objective.title} often present a scenario and ask which configuration or service combination best meets the stated requirements. Focus on cost, availability, and security tradeoffs.`,
  };
}

async function generateTeachContent(objective: any, scrapedMaterial: string = "") {
  const hasScraping = scrapedMaterial.trim().length > 100;

  const scrapingSection = hasScraping
    ? `
REAL COURSE MATERIAL (scraped from official documentation — use this as your primary source):
---
${scrapedMaterial.substring(0, 10000)}
---

IMPORTANT: Base your explanation on the above real documentation. Extract actual facts, terminology, service names, configuration options, and limits from it. Do NOT fabricate specifics — if the scraped content covers a concept, quote or paraphrase it accurately. If the scraped content does not cover a point, use your training knowledge for that part but clearly stay grounded in the real material.`
    : `
No scraped material available. Use your training knowledge, but be accurate and specific — avoid generic AI-generated filler.`;

  const prompt = `You are an expert instructor teaching a developer preparing for the ${objective.certification_id || 'cloud'} certification exam.

Your job is to TEACH the following exam objective from first principles. Do NOT tell the learner what they should study — explain the concept directly, as if you are the textbook.
${scrapingSection}

Exam Objective: ${objective.objective_code}. ${objective.title}
Domain: ${objective.domain_title || ''}
Description: ${objective.description}
Importance: ${objective.importance}

Write teaching content that:
- Explains WHAT the thing IS using the real documentation as your source (not "you need to know about X" — instead explain X itself with actual product details)
- Uses simple, direct language for a smart developer who is new to this topic
- Avoids filler phrases like "it is important to understand" or "you should know"
- Gives concrete examples drawn from the scraped material (e.g. real service limits, actual configuration options, real API names)
- Explains WHY this exists and what problem it solves
- Highlights the key tradeoffs that exam questions test

Return ONLY valid JSON with this exact structure:
{
  "what_it_is": "2-4 sentence plain explanation of what this IS. Ground this in the real documentation. No 'you should know' framing.",
  "analogy": "One concrete real-world analogy that makes the concept click (1-2 sentences)",
  "why_it_exists": "1-2 sentences explaining the real problem this was built to solve",
  "how_it_works": "3-5 sentences explaining the mechanics — how it actually operates, with real details from the docs where available",
  "key_concepts": [
    {"term": "short term or sub-concept from the real docs", "definition": "plain 1-sentence definition based on actual documentation"}
  ],
  "common_mistakes": [
    "One specific misconception or trap the exam tests",
    "Another common mistake"
  ],
  "exam_tip": "The single most important thing to remember when answering exam questions about this topic (1-2 sentences, focused on tradeoffs or decision criteria)",
  "sources_used": ${hasScraping ? '"real documentation scraped via Bright Data"' : '"LLM training knowledge (no live documentation available)"'}
}`;

  try {
    const result = await createGroqJsonCompletion(prompt);

    if (!result?.what_it_is) {
      return buildFallbackTeachContent(objective);
    }

    return result;
  } catch (err: any) {
    console.warn("[teach] Groq generation failed:", err?.message);
    return buildFallbackTeachContent(objective);
  }
}
