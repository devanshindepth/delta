import { getDb } from "./index";

// ─── Certifications ───────────────────────────────────────────────────────────

export function getCertifications() {
  const db = getDb();
  return db.prepare("SELECT * FROM certifications ORDER BY created_at DESC").all() as any[];
}

export function getCertificationById(id: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM certifications WHERE id = ?").get(id) as any;
}

export function saveCertification(data: { id: string, code: string, title: string, provider: string, level: string, official_url: string, description: string, icon_prefix?: string }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO certifications (id, code, title, provider, level, official_url, description, icon_prefix)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.id, data.code, data.title, data.provider, data.level, data.official_url, data.description, data.icon_prefix || '[~]');
}

export function updateCertificationActivity(id: string) {
  const db = getDb();
  db.prepare("UPDATE certifications SET created_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
}

export function getExamVersion(certId: string, status: string = "active") {
  const db = getDb();
  return db
    .prepare("SELECT * FROM exam_versions WHERE certification_id = ? AND status = ? LIMIT 1")
    .get(certId, status) as any;
}

// ─── Knowledge Graph ─────────────────────────────────────────────────────────

export function saveExamVersion(data: { id: string, certification_id: string, version_code: string, status: string }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO exam_versions (id, certification_id, version_code, status)
    VALUES (?, ?, ?, ?)
  `).run(data.id, data.certification_id, data.version_code, data.status);
}

export function saveDomain(data: { id: string, exam_version_id: string, domain_code: string, title: string, sort_order: number }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO domains (id, exam_version_id, domain_code, title, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.id, data.exam_version_id, data.domain_code, data.title, data.sort_order);
}

export function saveObjective(data: { id: string, domain_id: string, objective_code: string, title: string, description: string, sort_order: number }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO objectives (id, domain_id, objective_code, title, description, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.id, data.domain_id, data.objective_code, data.title, data.description, data.sort_order);
}

export function getKnowledgeGraph(examVersionId: string) {
  const db = getDb();
  const domains = db
    .prepare("SELECT * FROM domains WHERE exam_version_id = ? ORDER BY sort_order ASC")
    .all(examVersionId) as any[];

  for (const domain of domains) {
    domain.objectives = db
      .prepare("SELECT * FROM objectives WHERE domain_id = ? ORDER BY sort_order ASC")
      .all(domain.id);
  }
  return domains;
}

import fs from "fs";
import path from "path";

let blueprintSkillsCache: Map<string, any[]> | null = null;

export function getSkillsForObjective(objectiveId: string): any[] {
  if (!blueprintSkillsCache) {
    blueprintSkillsCache = new Map();
    try {
      const blueprintsDir = path.join(process.cwd(), "data", "blueprints");
      if (fs.existsSync(blueprintsDir)) {
        const files = fs.readdirSync(blueprintsDir);
        for (const file of files) {
          if (!file.endsWith(".json") || file === "changes-timeline.json") continue;
          const content = JSON.parse(fs.readFileSync(path.join(blueprintsDir, file), "utf-8"));
          for (const domain of content.domains || []) {
            for (const obj of domain.objectives || []) {
              if (obj.id && obj.skills) {
                blueprintSkillsCache.set(obj.id, obj.skills);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[queries] Failed to load blueprint skills cache:", e);
    }
  }
  return blueprintSkillsCache.get(objectiveId) || [];
}

export function getObjectivesByVersion(examVersionId: string) {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT o.*, d.domain_code, d.title as domain_title, d.sort_order as domain_sort
      FROM objectives o
      JOIN domains d ON o.domain_id = d.id
      WHERE d.exam_version_id = ?
      ORDER BY d.sort_order ASC, o.sort_order ASC
    `)
    .all(examVersionId) as any[];
  for (const obj of rows) {
    obj.skills = getSkillsForObjective(obj.id);
  }
  return rows;
}

export function getObjectiveById(id: string) {
  const db = getDb();
  const obj = db
    .prepare(`
      SELECT o.*, d.domain_code, d.title as domain_title, d.exam_version_id,
             ev.certification_id
      FROM objectives o
      JOIN domains d ON o.domain_id = d.id
      JOIN exam_versions ev ON d.exam_version_id = ev.id
      WHERE o.id = ?
    `)
    .get(id) as any;
  if (obj) {
    obj.skills = getSkillsForObjective(obj.id);
  }
  return obj;
}

// ─── Practice Questions ───────────────────────────────────────────────────────

export function getQuestionsByObjective(objectiveId: string) {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM practice_questions WHERE objective_id = ? ORDER BY rowid ASC")
    .all(objectiveId) as any[];
  return rows.map(parseQuestion);
}

export function getQuestionsByVersion(examVersionId: string) {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT pq.*
      FROM practice_questions pq
      JOIN objectives o ON pq.objective_id = o.id
      JOIN domains d ON o.domain_id = d.id
      WHERE d.exam_version_id = ?
      ORDER BY o.sort_order ASC, pq.rowid ASC
    `)
    .all(examVersionId) as any[];
  return rows.map(parseQuestion);
}

export function getQuestionById(id: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM practice_questions WHERE id = ?").get(id) as any;
  if (!row) return null;
  return parseQuestion(row);
}

export function savePracticeQuestion(data: any) {
  const db = getDb();
  db.prepare(`
    INSERT INTO practice_questions (
      id, objective_id, question_type, difficulty, stem, options_json, correct_answer, explanation, official_doc_url, service_tags, validation_status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    data.id,
    data.objective_id,
    data.question_type,
    data.difficulty,
    data.stem,
    data.options ? JSON.stringify(data.options) : null,
    typeof data.correct_answer === 'object' ? JSON.stringify(data.correct_answer) : data.correct_answer,
    data.explanation,
    data.official_doc_url,
    data.service_tags ? JSON.stringify(data.service_tags) : '[]',
    data.validation_status
  );
}

function parseQuestion(row: any) {
  return {
    ...row,
    options: row.options_json ? tryParse(row.options_json, []) : [],
    ordering_items: row.ordering_items_json ? tryParse(row.ordering_items_json, []) : [],
    matching_pairs: row.matching_pairs_json ? tryParse(row.matching_pairs_json, []) : [],
    case_study: row.case_study_json ? tryParse(row.case_study_json, null) : null,
    service_tags: row.service_tags ? tryParse(row.service_tags, []) : [],
    correct_answer: tryParseAnswer(row.correct_answer),
  };
}

function tryParse(str: string, fallback: any) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function tryParseAnswer(answer: string) {
  if (!answer) return answer;
  try {
    const parsed = JSON.parse(answer);
    return parsed;
  } catch {
    return answer;
  }
}

// ─── Learner Progress ─────────────────────────────────────────────────────────

export function getLearnerProgress(userId: string, objectiveId: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM learner_progress WHERE user_id = ? AND objective_id = ?")
    .get(userId, objectiveId) as any;
}

export function getAllProgressForUser(userId: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM learner_progress WHERE user_id = ? ORDER BY last_attempted_at DESC")
    .all(userId) as any[];
}

export function upsertLearnerProgress(
  userId: string,
  objectiveId: string,
  isCorrect: boolean
) {
  const db = getDb();
  const existing = getLearnerProgress(userId, objectiveId) as any;
  const now = new Date().toISOString();

  if (!existing) {
    const id = `prog-${userId}-${objectiveId}-${Date.now()}`;
    const masteryScore = isCorrect ? 1.0 : 0.0;
    const status = isCorrect ? "mastered" : "needs_review";
    db.prepare(`
      INSERT INTO learner_progress (id, user_id, objective_id, status, attempts, correct_count, last_attempted_at, mastery_score)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      id,
      userId,
      objectiveId,
      status,
      isCorrect ? 1 : 0,
      now,
      masteryScore
    );
  } else {
    const newAttempts = existing.attempts + 1;
    const newCorrect = existing.correct_count + (isCorrect ? 1 : 0);
    const masteryScore = newCorrect / newAttempts;
    const status =
      masteryScore >= 0.8
        ? "mastered"
        : masteryScore >= 0.5
        ? "in_progress"
        : "needs_review";

    db.prepare(`
      UPDATE learner_progress
      SET attempts = ?, correct_count = ?, last_attempted_at = ?, mastery_score = ?, status = ?
      WHERE user_id = ? AND objective_id = ?
    `).run(newAttempts, newCorrect, now, masteryScore, status, userId, objectiveId);
  }
}

// ─── Practice Attempts ────────────────────────────────────────────────────────

export function savePracticeAttempt(
  userId: string,
  questionId: string,
  answerGiven: string,
  isCorrect: boolean,
  timeSpentSeconds: number = 0
) {
  const db = getDb();
  const id = `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`
    INSERT INTO practice_attempts (id, user_id, question_id, answer_given, is_correct, time_spent_seconds)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, questionId, answerGiven, isCorrect ? 1 : 0, timeSpentSeconds);
}

export function getRecentAttempts(userId: string, limit: number = 20) {
  const db = getDb();
  return db
    .prepare(`
      SELECT pa.*, pq.stem, pq.question_type, pq.objective_id
      FROM practice_attempts pa
      JOIN practice_questions pq ON pa.question_id = pq.id
      WHERE pa.user_id = ?
      ORDER BY pa.attempted_at DESC
      LIMIT ?
    `)
    .all(userId, limit) as any[];
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export function getDashboardStats(userId: string, certId: string) {
  const db = getDb();
  const version = getExamVersion(certId);
  if (!version) return { totalObjectives: 0, masteredCount: 0, inProgressCount: 0, totalQuestions: 0, attemptedCount: 0 };

  const totalObjectives = (db
    .prepare(`
      SELECT COUNT(*) as c FROM objectives o
      JOIN domains d ON o.domain_id = d.id
      WHERE d.exam_version_id = ?
    `)
    .get(version.id) as any).c;

  const masteredCount = (db
    .prepare(`
      SELECT COUNT(*) as c FROM learner_progress lp
      JOIN objectives o ON lp.objective_id = o.id
      JOIN domains d ON o.domain_id = d.id
      WHERE lp.user_id = ? AND d.exam_version_id = ? AND lp.status = 'mastered'
    `)
    .get(userId, version.id) as any).c;

  const inProgressCount = (db
    .prepare(`
      SELECT COUNT(*) as c FROM learner_progress lp
      JOIN objectives o ON lp.objective_id = o.id
      JOIN domains d ON o.domain_id = d.id
      WHERE lp.user_id = ? AND d.exam_version_id = ? AND lp.status = 'in_progress'
    `)
    .get(userId, version.id) as any).c;

  const totalQuestions = (db
    .prepare(`
      SELECT COUNT(*) as c FROM practice_questions pq
      JOIN objectives o ON pq.objective_id = o.id
      JOIN domains d ON o.domain_id = d.id
      WHERE d.exam_version_id = ?
    `)
    .get(version.id) as any).c;

  const attemptedCount = (db
    .prepare(`
      SELECT COUNT(DISTINCT pa.question_id) as c
      FROM practice_attempts pa
      JOIN practice_questions pq ON pa.question_id = pq.id
      JOIN objectives o ON pq.objective_id = o.id
      JOIN domains d ON o.domain_id = d.id
      WHERE pa.user_id = ? AND d.exam_version_id = ?
    `)
    .get(userId, version.id) as any).c;

  const readinessScore =
    totalObjectives > 0
      ? Math.round((masteredCount / totalObjectives) * 100)
      : 0;

  return {
    totalObjectives,
    masteredCount,
    inProgressCount,
    totalQuestions,
    attemptedCount,
    readinessScore,
  };
}

// ─── Scraped Sources ──────────────────────────────────────────────────────────

export function saveScrapedSource(data: {
  id: string;
  url: string;
  title?: string;
  rawContent?: string;
  contentHash?: string;
  scrapeMethod?: string;
  status?: string;
  objectiveId?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO scraped_sources (id, url, title, raw_content, content_hash, scrape_method, status, objective_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.url,
    data.title || null,
    data.rawContent || null,
    data.contentHash || null,
    data.scrapeMethod || "native",
    data.status || "success",
    data.objectiveId || null
  );
}

export function getScrapedSources(objectiveId?: string) {
  const db = getDb();
  if (objectiveId) {
    return db
      .prepare("SELECT * FROM scraped_sources WHERE objective_id = ? ORDER BY scraped_at DESC")
      .all(objectiveId) as any[];
  }
  return db
    .prepare("SELECT * FROM scraped_sources ORDER BY scraped_at DESC LIMIT 50")
    .all() as any[];
}

/**
 * Returns the most recent successfully scraped source for an objective
 * if it was scraped within `maxAgeHours` (default 24h). Returns null if stale or missing.
 */
export function getRecentScrapedSourceForObjective(
  objectiveId: string,
  maxAgeHours: number = 24
): any | null {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT * FROM scraped_sources
      WHERE objective_id = ?
        AND status = 'success'
        AND raw_content IS NOT NULL
        AND raw_content != ''
        AND datetime(scraped_at) >= datetime('now', '-' || ? || ' hours')
      ORDER BY scraped_at DESC
      LIMIT 1
    `)
    .get(objectiveId, maxAgeHours) as any;
  return row || null;
}

/**
 * Delete all scraped sources for an objective, forcing a fresh scrape next time.
 */
export function invalidateScrapedSourcesForObjective(objectiveId: string) {
  const db = getDb();
  db.prepare("DELETE FROM scraped_sources WHERE objective_id = ?").run(objectiveId);
}

/**
 * Delete all AI-generated practice questions for an objective so they get
 * regenerated with the latest scrape content.
 */
export function deleteGeneratedQuestionsForObjective(objectiveId: string) {
  const db = getDb();
  db.prepare(
    "DELETE FROM practice_questions WHERE objective_id = ? AND validation_status = 'ai_generated'"
  ).run(objectiveId);
}

/**
 * Get all objectives for a certification (across all active exam versions).
 */
export function getObjectivesByCertId(certId: string): any[] {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT o.*, d.domain_code, d.title as domain_title, d.exam_version_id,
             ev.certification_id
      FROM objectives o
      JOIN domains d ON o.domain_id = d.id
      JOIN exam_versions ev ON d.exam_version_id = ev.id
      WHERE ev.certification_id = ?
        AND ev.status = 'active'
      ORDER BY d.sort_order ASC, o.sort_order ASC
    `)
    .all(certId) as any[];
  for (const obj of rows) {
    obj.skills = getSkillsForObjective(obj.id);
  }
  return rows;
}

// ─── Freshness Alerts ─────────────────────────────────────────────────────────

export function getFreshnessAlerts(unreadOnly: boolean = false) {
  const db = getDb();
  const query = unreadOnly
    ? "SELECT fa.*, o.title as objective_title, o.objective_code FROM freshness_alerts fa JOIN objectives o ON fa.objective_id = o.id WHERE fa.is_read = 0 ORDER BY fa.detected_at DESC"
    : "SELECT fa.*, o.title as objective_title, o.objective_code FROM freshness_alerts fa JOIN objectives o ON fa.objective_id = o.id ORDER BY fa.detected_at DESC";
  return db.prepare(query).all() as any[];
}

export function markAlertRead(alertId: string) {
  const db = getDb();
  db.prepare("UPDATE freshness_alerts SET is_read = 1 WHERE id = ?").run(alertId);
}

export function saveFreshnessAlert(data: {
  id: string;
  objectiveId: string;
  alertType: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO freshness_alerts (id, objective_id, alert_type, title, summary, source_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.id, data.objectiveId, data.alertType, data.title, data.summary || null, data.sourceUrl || null);
}
