import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getObjectivesByCertId,
  getCertificationById,
  invalidateScrapedSourcesForObjective,
  deleteGeneratedQuestionsForObjective,
  saveScrapedSource,
  updateCertificationActivity,
} from "@/lib/db/queries";
import {
  isBrightDataConfigured,
  scrapeObjectiveContent,
} from "@/lib/ingestion/brightdata";
import { isGroqConfigured } from "@/lib/groq";

export const maxDuration = 300;

const CONCURRENCY = 3;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cert = getCertificationById(id);
  if (!cert) {
    return NextResponse.json(
      { success: false, error: "Certification not found" },
      { status: 404 }
    );
  }

  const objectives = getObjectivesByCertId(id);
  if (objectives.length === 0) {
    return NextResponse.json(
      { success: false, error: "No objectives found for this certification" },
      { status: 404 }
    );
  }

  const canScrape = isBrightDataConfigured();
  const canGenerate = isGroqConfigured();

  if (!canScrape && !canGenerate) {
    return NextResponse.json(
      { success: false, error: "Neither Bright Data nor Groq is configured" },
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();

  function line(obj: object) {
    return encoder.encode(JSON.stringify(obj) + "\n");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const total = objectives.length;
      let succeeded = 0;
      let failed = 0;

      controller.enqueue(
        line({
          type: "start",
          message: `[~] updating "${cert.title}" (${cert.provider}) — ${total} objective(s) in batches of ${CONCURRENCY}`,
          total,
        })
      );

      for (const obj of objectives) {
        invalidateScrapedSourcesForObjective(obj.id);
        deleteGeneratedQuestionsForObjective(obj.id);
      }

      controller.enqueue(
        line({
          type: "progress",
          message: `[$] cleared stale cache for all ${total} objectives`,
        })
      );

      for (let batchStart = 0; batchStart < total; batchStart += CONCURRENCY) {
        const batch = objectives.slice(batchStart, batchStart + CONCURRENCY);

        controller.enqueue(
          line({
            type: "progress",
            message: `[$] scraping batch ${Math.floor(batchStart / CONCURRENCY) + 1}/${Math.ceil(total / CONCURRENCY)}: ${batch.map((o: any) => o.objective_code).join(", ")}`,
          })
        );

        const results = await Promise.allSettled(
          batch.map((obj: any) =>
            canScrape
              ? scrapeObjectiveContent({
                  id: obj.id,
                  title: obj.title,
                  description: obj.description,
                  certification_id: obj.certification_id,
                  domain_title: obj.domain_title,
                  objective_code: obj.objective_code,
                  cert_title: cert.title,
                  cert_provider: cert.provider,
                  skills: obj.skills,
                })
              : Promise.resolve(null)
          )
        );

        for (let i = 0; i < batch.length; i++) {
          const obj = batch[i];
          const result = results[i];
          const globalIndex = batchStart + i + 1;

          if (result.status === "rejected") {
            controller.enqueue(line({
              type: "objective_error",
              message: `[-] ${obj.objective_code}. ${obj.title} — ${result.reason?.message ?? "scrape failed"}`,
              objectiveId: obj.id,
              index: globalIndex,
              total
            }));
            failed++;
            continue;
          }
          
          const scrapeResult = result.value;

          if (!scrapeResult) {
            // Bright Data not configured
            controller.enqueue(
              line({
                type: "objective_done",
                message: `[~] ${obj.objective_code}. ${obj.title} — cache cleared (LLM on next open)`,
                objectiveId: obj.id,
                index: globalIndex,
                total,
              })
            );
            succeeded++;
            continue;
          }

          if (scrapeResult.scrape_status?.outcome === "failed") {
            controller.enqueue(line({
              type: "objective_error",
              message: `[-] ${obj.objective_code}. ${obj.title} — ${scrapeResult.scrape_status?.failure_reason ?? "scrape failed"} (will retry on next open)`,
              objectiveId: obj.id,
              index: globalIndex,
              total,
              scrape_status: scrapeResult.scrape_status
            }));
            failed++;
            continue;
          }

          for (const src of scrapeResult.sources) {
            const sourceId = `src-upd-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
            saveScrapedSource({
              id: sourceId,
              url: src.url,
              title: src.title,
              rawContent: src.content,
              contentHash: `sha256:${crypto.createHash("sha256").update(src.content).digest("hex")}`,
              scrapeMethod: scrapeResult.scrapeMethod,
              status: "success",
              objectiveId: obj.id,
            });
          }

          const healPrefix = scrapeResult.scrape_status.healed
            ? `[~] scraper healed — missing ${scrapeResult.scrape_status.missing_fields_recovered || 'fields'} recovered\n`
            : "";

          controller.enqueue(
            line({
              type: "objective_done",
              message: `${healPrefix}[+] ${obj.objective_code}. ${obj.title} — ${scrapeResult.scrapeMethod}`,
              objectiveId: obj.id,
              index: globalIndex,
              total,
              scrape_status: scrapeResult.scrape_status
            })
          );
          succeeded++;
        }
      }

      updateCertificationActivity(id);

      controller.enqueue(
        line({
          type: "done",
          message: `[+] done — ${succeeded}/${total} objectives updated${failed > 0 ? `, ${failed} failed` : ""}`,
          succeeded,
          failed,
          total,
        })
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
