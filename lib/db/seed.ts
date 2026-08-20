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

  // All 3 already seeded — nothing to do
  if (existing.length >= 3) return;

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
