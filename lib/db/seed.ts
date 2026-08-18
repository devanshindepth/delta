import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export function seedDataIfEmpty(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) as c FROM certifications").get() as { c: number };
  // Check for actual objective data, not just the exam_version row
  const awsObjectivesCount = db.prepare(`
    SELECT COUNT(*) as c FROM objectives o
    JOIN domains d ON o.domain_id = d.id
    JOIN exam_versions ev ON d.exam_version_id = ev.id
    WHERE ev.certification_id = 'cert-aws-saa'
  `).get() as { c: number };

  if (count.c > 0 && awsObjectivesCount.c >= 10) return;

  // Load blueprint from JSON file
  const blueprintPath = path.join(process.cwd(), "data", "blueprints", "ai-103.json");
  let blueprint: any = null;

  if (fs.existsSync(blueprintPath)) {
    try {
      blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8"));
    } catch (e) {
      console.warn("[seed] Failed to parse ai-103.json blueprint:", e);
    }
  }

  const awsBlueprintPath = path.join(process.cwd(), "data", "blueprints", "aws-saa.json");
  let awsBlueprint: any = null;
  if (fs.existsSync(awsBlueprintPath)) {
    try {
      awsBlueprint = JSON.parse(fs.readFileSync(awsBlueprintPath, "utf-8"));
    } catch (e) {}
  }

  db.transaction(() => {
    if (blueprint) {
      seedFromBlueprint(db, blueprint);
    } else {
      seedFallback(db);
    }
    
    if (awsBlueprint) {
      seedFromBlueprint(db, awsBlueprint);
    }

    // Also seed GCP certs as stubs for the catalog
    seedAdditionalCerts(db);
  })();
}

function seedFromBlueprint(db: Database.Database, blueprint: any) {
  const cert = blueprint.certification;

  // Insert certification
  db.prepare(`
    INSERT OR IGNORE INTO certifications (id, code, title, provider, level, official_url, description, icon_prefix)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cert.id || "cert-azure-ai103",
    cert.code || "AI-103",
    cert.title,
    cert.provider,
    "Intermediate",
    cert.official_url,
    cert.description || "",
    "[~]"
  );

  // Insert exam versions
  const certId = cert.id || "cert-azure-ai103";
  for (const ver of (blueprint.exam_versions || [])) {
    db.prepare(`
      INSERT OR IGNORE INTO exam_versions (id, certification_id, version_code, status, release_date, retirement_date, change_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      ver.id,
      certId,
      ver.version_code,
      ver.status === "deprecated" ? "deprecated" : ver.status,
      ver.release_date || null,
      ver.retirement_date || null,
      ver.change_summary || null
    );
  }

  // Find active exam version
  const activeVer = (blueprint.exam_versions || []).find((v: any) => v.status === "active");
  if (!activeVer) return;

  // Insert domains + objectives
  const domainMap: Record<string, string> = {};
  for (const domain of (blueprint.domains || [])) {
    db.prepare(`
      INSERT OR IGNORE INTO domains (id, exam_version_id, domain_code, title, description, weight_percentage_min, weight_percentage_max, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      domain.id,
      activeVer.id,
      domain.domain_code,
      domain.title,
      domain.description || "",
      domain.weight_percentage_min || 0,
      domain.weight_percentage_max || 0,
      domain.sort_order || 0
    );
    domainMap[domain.id] = domain.id;

    for (const obj of (domain.objectives || [])) {
      db.prepare(`
        INSERT OR IGNORE INTO objectives (id, domain_id, objective_code, title, description, importance, freshness_status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        obj.id,
        domain.id,
        obj.objective_code,
        obj.title,
        obj.description || "",
        obj.importance || "medium",
        obj.freshness_status || "current",
        obj.sort_order || 0
      );
    }
  }

  // Insert practice questions
  for (const q of (blueprint.practice_questions || [])) {
    const optionsJson = q.options ? JSON.stringify(q.options) : null;
    const orderingJson = q.ordering_items ? JSON.stringify(q.ordering_items) : null;
    const matchingJson = q.matching_pairs ? JSON.stringify(q.matching_pairs) : null;
    const caseStudyJson = q.case_study ? JSON.stringify(q.case_study) : null;
    const correctAnswer = typeof q.correct_answer === "object"
      ? JSON.stringify(q.correct_answer)
      : q.correct_answer;
    const serviceTags = q.service_tags ? JSON.stringify(q.service_tags) : "[]";

    db.prepare(`
      INSERT OR IGNORE INTO practice_questions
        (id, objective_id, question_type, difficulty, stem, options_json, ordering_items_json, matching_pairs_json, case_study_json, sandbox_starter_code, sandbox_test_code, correct_answer, explanation, official_doc_url, service_tags, validation_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      q.id,
      q.objective_id,
      q.question_type,
      q.difficulty || "exam",
      q.stem,
      optionsJson,
      orderingJson,
      matchingJson,
      caseStudyJson,
      q.sandbox_starter_code || null,
      q.sandbox_test_code || null,
      correctAnswer,
      q.explanation || "",
      q.official_doc_url || null,
      serviceTags,
      q.validation_status || "verified_accurate"
    );
  }

  // Seed a demo freshness alert to show the Bright Data pipeline value
  db.prepare(`
    INSERT OR IGNORE INTO freshness_alerts (id, objective_id, alert_type, title, summary, source_url, detected_at, is_read)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "alert-001",
    "obj-302",
    "deprecated",
    "LUIS.ai retirement confirmed",
    "Microsoft has confirmed LUIS.ai will be retired. All authoring and prediction workloads must migrate to Conversational Language Understanding (CLU) in Azure AI Language Studio.",
    "https://learn.microsoft.com/en-us/azure/ai-services/language-service/conversational-language-understanding/overview",
    "2025-01-15T00:00:00.000Z",
    0
  );

  db.prepare(`
    INSERT OR IGNORE INTO freshness_alerts (id, objective_id, alert_type, title, summary, source_url, detected_at, is_read)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "alert-002",
    "obj-202",
    "updated",
    "Document Intelligence API updated to 2024-11-30",
    "Azure AI Document Intelligence REST API has been updated. The new version introduces improved table extraction, selection mark detection, and query fields support.",
    "https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/whats-new",
    "2025-02-01T00:00:00.000Z",
    0
  );
}

function seedFallback(db: Database.Database) {
  db.prepare(`
    INSERT OR IGNORE INTO certifications (id, code, title, provider, level, official_url, description, icon_prefix)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "cert-azure-ai103",
    "AI-103",
    "Azure AI Engineer Associate",
    "Microsoft",
    "Intermediate",
    "https://learn.microsoft.com/en-us/training/courses/ai-103t00",
    "Validates proficiency in architecting and implementing Azure AI solutions.",
    "[~]"
  );
}

function seedAdditionalCerts(db: Database.Database) {
  const certs = [
    {
      id: "cert-aws-saa",
      code: "SAA-C03",
      title: "AWS Solutions Architect Associate",
      provider: "Amazon Web Services",
      level: "Associate",
      url: "https://aws.amazon.com/certification/certified-solutions-architect-associate/",
      desc: "Design highly available, cost-effective, fault-tolerant, and scalable distributed systems on AWS.",
      icon: "[+]"
    },
    {
      id: "cert-gcp-ace",
      code: "ACE",
      title: "Google Cloud Associate Cloud Engineer",
      provider: "Google Cloud",
      level: "Associate",
      url: "https://cloud.google.com/learn/certification/cloud-engineer",
      desc: "Deploy applications, monitor operations, and manage enterprise solutions on Google Cloud Platform.",
      icon: "[>]"
    },
    {
      id: "cert-cka",
      code: "CKA",
      title: "Certified Kubernetes Administrator",
      provider: "CNCF / Linux Foundation",
      level: "Professional",
      url: "https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/",
      desc: "Demonstrate skills, knowledge, and competencies to perform the responsibilities of a Kubernetes administrator.",
      icon: "[#]"
    },
    {
      id: "cert-hashicorp-tf",
      code: "TF-003",
      title: "HashiCorp Certified: Terraform Associate",
      provider: "HashiCorp",
      level: "Associate",
      url: "https://developer.hashicorp.com/certifications/infrastructure-automation",
      desc: "Understand infrastructure as code (IaC) concepts and demonstrate core Terraform skills.",
      icon: "[-]"
    }
  ];

  for (const c of certs) {
    db.prepare(`
      INSERT OR IGNORE INTO certifications (id, code, title, provider, level, official_url, description, icon_prefix)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(c.id, c.code, c.title, c.provider, c.level, c.url, c.desc, c.icon);
  }
}
