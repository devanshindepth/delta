import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * Seeds the database with exactly 3 curated certification blueprints:
 *   1. Microsoft AI-103 (Azure AI Engineer)
 *   2. AWS SAA-C03 (Solutions Architect Associate)
 *   3. Google Cloud ACE (Associate Cloud Engineer)
 *
 * Guard: only runs if none of the 3 blueprint cert IDs are present.
 */
export function seedDataIfEmpty(db: Database.Database) {
  const existing = db
    .prepare(
      "SELECT id FROM certifications WHERE id IN ('cert-ai-103', 'cert-aws-saa', 'cert-gcp-ace')"
    )
    .all() as { id: string }[];

  // Check if freshness alerts table has entries
  const existingAlerts = db.prepare("SELECT COUNT(*) as cnt FROM freshness_alerts").get() as { cnt: number };
  const needsAlerts = (existingAlerts?.cnt ?? 0) === 0;

  // All 3 certs already seeded and alerts present — nothing to do
  if (existing.length >= 3 && !needsAlerts) return;

  const blueprints = [
    "ai-103.json",
    "aws-saa.json",
    "gcp-ace.json",
  ];

  db.transaction(() => {
    for (const filename of blueprints) {
      const blueprintPath = path.join(
        process.cwd(),
        "data",
        "blueprints",
        filename
      );
      if (!fs.existsSync(blueprintPath)) {
        console.warn(`[seed] Blueprint not found: ${filename}`);
        continue;
      }
      let blueprint: any;
      try {
        blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8"));
      } catch (e) {
        console.warn(`[seed] Failed to parse ${filename}:`, e);
        continue;
      }
      seedFromBlueprint(db, blueprint);
    }

    // Seed official documentation sources for all 3 blueprints
    const sourcesPath = path.join(
      process.cwd(),
      "data",
      "blueprints",
      "scraped-sources.json"
    );
    if (fs.existsSync(sourcesPath)) {
      try {
        const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf-8"));
        for (const src of sources) {
          db.prepare(`
            INSERT OR REPLACE INTO scraped_sources
              (id, url, title, raw_content, content_hash, scraped_at, scrape_method, status, objective_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            src.id,
            src.url,
            src.title,
            src.raw_content,
            src.content_hash,
            src.scraped_at || new Date().toISOString(),
            src.scrape_method || "brightdata-scraper-studio-primary",
            src.status || "success",
            src.objective_id
          );
        }
        console.info(`[seed] Seeded ${sources.length} official documentation sources`);
      } catch (e) {
        console.warn("[seed] Failed to parse scraped-sources.json:", e);
      }
    }

    // Seed freshness alerts
    const timelinePath = path.join(
      process.cwd(),
      "data",
      "blueprints",
      "changes-timeline.json"
    );
    if (fs.existsSync(timelinePath)) {
      try {
        const changes = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
        for (const ch of changes) {
          const alertType = ch.change_type === "api_deprecation" ? "deprecated" : ch.severity === "breaking" ? "breaking_change" : "updated";
          const objId = Array.isArray(ch.affected_objectives) && ch.affected_objectives.length > 0 ? ch.affected_objectives[0] : "obj-202";
          db.prepare(`
            INSERT OR IGNORE INTO freshness_alerts
              (id, objective_id, alert_type, title, summary, source_url, detected_at, is_read)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
          `).run(
            ch.id,
            objId,
            alertType,
            ch.title,
            ch.summary,
            ch.official_changelog_url || null,
            ch.detected_at || new Date().toISOString()
          );
        }
        console.info(`[seed] Seeded ${changes.length} freshness alerts`);
      } catch (e) {
        console.warn("[seed] Failed to parse changes-timeline.json:", e);
      }
    }
  })();
}

function seedFromBlueprint(db: Database.Database, blueprint: any) {
  const cert = blueprint.certification;
  const certId = cert.id;

  db.prepare(`
    INSERT OR IGNORE INTO certifications
      (id, code, title, provider, level, official_url, description, icon_prefix)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    certId,
    cert.code,
    cert.title,
    cert.provider,
    cert.level || "Intermediate",
    cert.official_url,
    cert.description || "",
    cert.icon_prefix || "[~]"
  );

  // Insert exam versions
  for (const ver of blueprint.exam_versions || []) {
    db.prepare(`
      INSERT OR IGNORE INTO exam_versions
        (id, certification_id, version_code, status, release_date, retirement_date, change_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      ver.id,
      certId,
      ver.version_code,
      ver.status ?? "active",
      ver.release_date ?? null,
      ver.retirement_date ?? null,
      ver.change_summary ?? null
    );
  }

  // Find active version for linking domains
  const activeVer = (blueprint.exam_versions ?? []).find(
    (v: any) => v.status === "active"
  );
  if (!activeVer) {
    console.warn(`[seed] No active exam version found for ${certId}`);
    return;
  }

  // Domains + objectives
  for (const domain of blueprint.domains ?? []) {
    db.prepare(`
      INSERT OR IGNORE INTO domains
        (id, exam_version_id, domain_code, title, description,
         weight_percentage_min, weight_percentage_max, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      domain.id,
      activeVer.id,
      domain.domain_code,
      domain.title,
      domain.description ?? "",
      domain.weight_percentage_min ?? 0,
      domain.weight_percentage_max ?? 0,
      domain.sort_order ?? 0
    );

    for (const obj of domain.objectives ?? []) {
      db.prepare(`
        INSERT OR IGNORE INTO objectives
          (id, domain_id, objective_code, title, description,
           importance, freshness_status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        obj.id,
        domain.id,
        obj.objective_code,
        obj.title,
        obj.description ?? "",
        obj.importance ?? "medium",
        obj.freshness_status ?? "current",
        obj.sort_order ?? 0
      );
    }
  }

  // Practice questions (blueprints may include pre-authored ones)
  for (const q of blueprint.practice_questions ?? []) {
    const correctAnswer =
      typeof q.correct_answer === "object"
        ? JSON.stringify(q.correct_answer)
        : q.correct_answer;

    db.prepare(`
      INSERT OR IGNORE INTO practice_questions
        (id, objective_id, question_type, difficulty, stem,
         options_json, ordering_items_json, matching_pairs_json,
         case_study_json, sandbox_starter_code, sandbox_test_code,
         correct_answer, explanation, official_doc_url,
         service_tags, validation_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      q.id,
      q.objective_id,
      q.question_type,
      q.difficulty ?? "exam",
      q.stem,
      q.options ? JSON.stringify(q.options) : null,
      q.ordering_items ? JSON.stringify(q.ordering_items) : null,
      q.matching_pairs ? JSON.stringify(q.matching_pairs) : null,
      q.case_study ? JSON.stringify(q.case_study) : null,
      q.sandbox_starter_code ?? null,
      q.sandbox_test_code ?? null,
      correctAnswer,
      q.explanation ?? "",
      q.official_doc_url ?? null,
      q.service_tags ? JSON.stringify(q.service_tags) : "[]",
      q.validation_status ?? "verified_accurate"
    );
  }

  console.info(
    `[seed] Seeded ${certId}: ${(blueprint.domains ?? []).length} domains, ` +
    `${(blueprint.domains ?? []).reduce((n: number, d: any) => n + (d.objectives?.length ?? 0), 0)} objectives`
  );
}
