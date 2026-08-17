import { getDb } from "./index";
import {
  Goal,
  CompetencyNode,
  CompetencyEdge,
  EvidenceRecord,
  TechnicalChange,
  ChangeImpact,
  LearningDelta,
  Challenge,
  ChallengeSubmission,
  Source,
  HeatmapEntry,
} from "../types";

// ==========================================
// Goals
// ==========================================

export function saveGoal(goal: Goal): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO goals (id, user_id, title, description, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, description = excluded.description,
      status = excluded.status, updated_at = excluded.updated_at
  `).run(goal.id, goal.user_id, goal.title, goal.description, goal.status, goal.created_at, goal.updated_at);
}

export function getGoal(id: string): Goal | null {
  const db = getDb();
  return db.prepare("SELECT * FROM goals WHERE id = ?").get(id) as Goal | null;
}

export function listGoals(userId: string): Goal[] {
  const db = getDb();
  return db.prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Goal[];
}

export function deleteGoal(id: string): void {
  getDb().prepare("DELETE FROM goals WHERE id = ?").run(id);
}

// ==========================================
// Competency Nodes
// ==========================================

export function saveCompetencyNode(node: CompetencyNode): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO competency_nodes (id, goal_id, name, category, description, evidence_status, confidence, last_proven_at, position_x, position_y, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, category = excluded.category, description = excluded.description,
      evidence_status = excluded.evidence_status, confidence = excluded.confidence,
      last_proven_at = excluded.last_proven_at, position_x = excluded.position_x, position_y = excluded.position_y
  `).run(node.id, node.goal_id, node.name, node.category, node.description, node.evidence_status, node.confidence, node.last_proven_at, node.position_x, node.position_y, node.created_at);
}

export function getCompetencyNode(id: string): CompetencyNode | null {
  return getDb().prepare("SELECT * FROM competency_nodes WHERE id = ?").get(id) as CompetencyNode | null;
}

export function listCompetencyNodes(goalId: string): CompetencyNode[] {
  return getDb().prepare("SELECT * FROM competency_nodes WHERE goal_id = ? ORDER BY category, name").all(goalId) as CompetencyNode[];
}

export function updateNodeEvidence(nodeId: string, status: string, confidence: number, lastProvenAt: string | null): void {
  getDb().prepare("UPDATE competency_nodes SET evidence_status = ?, confidence = ?, last_proven_at = ? WHERE id = ?")
    .run(status, confidence, lastProvenAt, nodeId);
}

// ==========================================
// Competency Edges
// ==========================================

export function saveCompetencyEdge(edge: CompetencyEdge): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO competency_edges (id, goal_id, source_node_id, target_node_id, relationship)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source_node_id = excluded.source_node_id, target_node_id = excluded.target_node_id,
      relationship = excluded.relationship
  `).run(edge.id, edge.goal_id, edge.source_node_id, edge.target_node_id, edge.relationship);
}

export function listCompetencyEdges(goalId: string): CompetencyEdge[] {
  return getDb().prepare("SELECT * FROM competency_edges WHERE goal_id = ?").all(goalId) as CompetencyEdge[];
}

// ==========================================
// Evidence Records
// ==========================================

export function saveEvidenceRecord(record: EvidenceRecord): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO evidence_records (id, user_id, competency_node_id, evidence_type, details, confidence_delta, challenge_id, source_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(record.id, record.user_id, record.competency_node_id, record.evidence_type, record.details, record.confidence_delta, record.challenge_id || null, record.source_id || null, record.created_at);
}

export function listEvidenceRecords(userId: string, nodeId?: string): EvidenceRecord[] {
  const db = getDb();
  if (nodeId) {
    return db.prepare("SELECT * FROM evidence_records WHERE user_id = ? AND competency_node_id = ? ORDER BY created_at DESC").all(userId, nodeId) as EvidenceRecord[];
  }
  return db.prepare("SELECT * FROM evidence_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(userId) as EvidenceRecord[];
}

// ==========================================
// Technical Changes
// ==========================================

export function saveTechnicalChange(change: TechnicalChange): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO technical_changes (id, title, source_url, source_title, source_excerpt, change_type, significance, summary, raw_content, affected_technologies, detected_at, scraped_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, summary = excluded.summary, raw_content = excluded.raw_content,
      affected_technologies = excluded.affected_technologies
  `).run(change.id, change.title, change.source_url, change.source_title, change.source_excerpt, change.change_type, change.significance, change.summary, change.raw_content, JSON.stringify(change.affected_technologies), change.detected_at, change.scraped_at);
}

export function getTechnicalChange(id: string): TechnicalChange | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM technical_changes WHERE id = ?").get(id) as any;
  if (!row) return null;
  return { ...row, affected_technologies: JSON.parse(row.affected_technologies || "[]") };
}

export function listTechnicalChanges(limit = 50): TechnicalChange[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM technical_changes ORDER BY detected_at DESC LIMIT ?").all(limit) as any[];
  return rows.map((r) => ({ ...r, affected_technologies: JSON.parse(r.affected_technologies || "[]") }));
}

// ==========================================
// Change Impacts
// ==========================================

export function saveChangeImpact(impact: ChangeImpact): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO change_impacts (id, change_id, competency_node_id, goal_id, user_id, relevance_score, relevance_reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      relevance_score = excluded.relevance_score, relevance_reason = excluded.relevance_reason, status = excluded.status
  `).run(impact.id, impact.change_id, impact.competency_node_id, impact.goal_id, impact.user_id, impact.relevance_score, impact.relevance_reason, impact.status, impact.created_at);
}

export function listChangeImpacts(userId: string, changeId?: string): ChangeImpact[] {
  const db = getDb();
  if (changeId) {
    return db.prepare("SELECT * FROM change_impacts WHERE user_id = ? AND change_id = ? ORDER BY relevance_score DESC").all(userId, changeId) as ChangeImpact[];
  }
  return db.prepare("SELECT * FROM change_impacts WHERE user_id = ? AND status = 'new' ORDER BY relevance_score DESC LIMIT 50").all(userId) as ChangeImpact[];
}

export function updateImpactStatus(id: string, status: string): void {
  getDb().prepare("UPDATE change_impacts SET status = ? WHERE id = ?").run(status, id);
}

// ==========================================
// Learning Deltas
// ==========================================

export function saveLearningDelta(delta: LearningDelta): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO learning_deltas (id, user_id, change_id, competency_node_id, competency_name, status, required_concepts, estimated_hours, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status, required_concepts = excluded.required_concepts, estimated_hours = excluded.estimated_hours
  `).run(delta.id, delta.user_id, delta.change_id, delta.competency_node_id, delta.competency_name, delta.status, JSON.stringify(delta.required_concepts), delta.estimated_hours, delta.created_at);
}

export function listLearningDeltas(userId: string, changeId?: string): LearningDelta[] {
  const db = getDb();
  let rows: any[];
  if (changeId) {
    rows = db.prepare("SELECT * FROM learning_deltas WHERE user_id = ? AND change_id = ? ORDER BY status, competency_name").all(userId, changeId) as any[];
  } else {
    rows = db.prepare("SELECT * FROM learning_deltas WHERE user_id = ? ORDER BY status, competency_name LIMIT 100").all(userId) as any[];
  }
  return rows.map((r) => ({ ...r, required_concepts: JSON.parse(r.required_concepts || "[]") }));
}

// ==========================================
// Challenges
// ==========================================

export function saveChallenge(challenge: Challenge): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO challenges (id, competency_node_id, change_id, title, description, challenge_type, difficulty, language, starter_code, test_code, expected_output, verification_method, estimated_minutes, why_it_matters, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, description = excluded.description, starter_code = excluded.starter_code,
      test_code = excluded.test_code, expected_output = excluded.expected_output
  `).run(challenge.id, challenge.competency_node_id, challenge.change_id, challenge.title, challenge.description, challenge.challenge_type, challenge.difficulty, challenge.language, challenge.starter_code, challenge.test_code, challenge.expected_output, challenge.verification_method, challenge.estimated_minutes, challenge.why_it_matters, challenge.created_at);
}

export function getChallenge(id: string): Challenge | null {
  return getDb().prepare("SELECT * FROM challenges WHERE id = ?").get(id) as Challenge | null;
}

export function listChallenges(filters?: { competencyNodeId?: string; difficulty?: string; changeId?: string }): Challenge[] {
  const db = getDb();
  let query = "SELECT * FROM challenges WHERE 1=1";
  const params: any[] = [];
  if (filters?.competencyNodeId) { query += " AND competency_node_id = ?"; params.push(filters.competencyNodeId); }
  if (filters?.difficulty) { query += " AND difficulty = ?"; params.push(filters.difficulty); }
  if (filters?.changeId) { query += " AND change_id = ?"; params.push(filters.changeId); }
  query += " ORDER BY created_at DESC LIMIT 100";
  return db.prepare(query).all(...params) as Challenge[];
}

// ==========================================
// Challenge Submissions
// ==========================================

export function saveChallengeSubmission(sub: ChallengeSubmission): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO challenge_submissions (id, challenge_id, user_id, code, language, status, execution_output, test_results, counterexamples, duration_ms, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status, execution_output = excluded.execution_output,
      test_results = excluded.test_results, counterexamples = excluded.counterexamples,
      duration_ms = excluded.duration_ms
  `).run(sub.id, sub.challenge_id, sub.user_id, sub.code, sub.language, sub.status, sub.execution_output, JSON.stringify(sub.test_results), JSON.stringify(sub.counterexamples), sub.duration_ms, sub.submitted_at);
}

export function getChallengeSubmission(id: string): ChallengeSubmission | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM challenge_submissions WHERE id = ?").get(id) as any;
  if (!row) return null;
  return { ...row, test_results: JSON.parse(row.test_results || "[]"), counterexamples: JSON.parse(row.counterexamples || "[]") };
}

export function listChallengeSubmissions(challengeId: string, userId?: string): ChallengeSubmission[] {
  const db = getDb();
  let query = "SELECT * FROM challenge_submissions WHERE challenge_id = ?";
  const params: any[] = [challengeId];
  if (userId) { query += " AND user_id = ?"; params.push(userId); }
  query += " ORDER BY submitted_at DESC LIMIT 20";
  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r) => ({ ...r, test_results: JSON.parse(r.test_results || "[]"), counterexamples: JSON.parse(r.counterexamples || "[]") }));
}

// ==========================================
// Sources
// ==========================================

export function saveSource(source: Source): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO sources (id, user_id, title, url, source_type, raw_content, extracted_concepts, mapped_competency_ids, ingestion_status, scraped_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, raw_content = excluded.raw_content,
      extracted_concepts = excluded.extracted_concepts, mapped_competency_ids = excluded.mapped_competency_ids,
      ingestion_status = excluded.ingestion_status, scraped_at = excluded.scraped_at
  `).run(source.id, source.user_id, source.title, source.url, source.source_type, source.raw_content, JSON.stringify(source.extracted_concepts), JSON.stringify(source.mapped_competency_ids), source.ingestion_status, source.scraped_at, source.created_at);
}

export function getSource(id: string): Source | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as any;
  if (!row) return null;
  return { ...row, extracted_concepts: JSON.parse(row.extracted_concepts || "[]"), mapped_competency_ids: JSON.parse(row.mapped_competency_ids || "[]") };
}

export function listSources(userId: string): Source[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM sources WHERE user_id = ? ORDER BY created_at DESC").all(userId) as any[];
  return rows.map((r) => ({ ...r, extracted_concepts: JSON.parse(r.extracted_concepts || "[]"), mapped_competency_ids: JSON.parse(r.mapped_competency_ids || "[]") }));
}

// ==========================================
// Heatmap Entries
// ==========================================

export function saveHeatmapEntry(entry: HeatmapEntry & { id: string; user_id: string }): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO heatmap_entries (id, user_id, date, competency_node_id, level, evidence_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET level = excluded.level, evidence_count = excluded.evidence_count
  `).run(entry.id, entry.user_id, entry.date, entry.competency_node_id, entry.level, entry.evidence_count);
}

export function listHeatmapEntries(userId: string, startDate?: string, endDate?: string): (HeatmapEntry & { id: string; user_id: string })[] {
  const db = getDb();
  let query = "SELECT * FROM heatmap_entries WHERE user_id = ?";
  const params: any[] = [userId];
  if (startDate) { query += " AND date >= ?"; params.push(startDate); }
  if (endDate) { query += " AND date <= ?"; params.push(endDate); }
  query += " ORDER BY date DESC LIMIT 365";
  return db.prepare(query).all(...params) as any[];
}

// ==========================================
// Dashboard Aggregates
// ==========================================

export function getDashboardStats(userId: string, goalId: string) {
  const db = getDb();
  const totalNodes = (db.prepare("SELECT COUNT(*) as c FROM competency_nodes WHERE goal_id = ?").get(goalId) as any)?.c || 0;
  const provenNodes = (db.prepare("SELECT COUNT(*) as c FROM competency_nodes WHERE goal_id = ? AND evidence_status = 'proven'").get(goalId) as any)?.c || 0;
  const partialNodes = (db.prepare("SELECT COUNT(*) as c FROM competency_nodes WHERE goal_id = ? AND evidence_status = 'partial'").get(goalId) as any)?.c || 0;
  const staleNodes = (db.prepare("SELECT COUNT(*) as c FROM competency_nodes WHERE goal_id = ? AND evidence_status = 'stale'").get(goalId) as any)?.c || 0;
  const newImpacts = (db.prepare("SELECT COUNT(*) as c FROM change_impacts WHERE user_id = ? AND status = 'new'").get(userId) as any)?.c || 0;
  const totalChallenges = (db.prepare("SELECT COUNT(*) as c FROM challenges c JOIN competency_nodes cn ON c.competency_node_id = cn.id WHERE cn.goal_id = ?").get(goalId) as any)?.c || 0;
  const passedSubmissions = (db.prepare("SELECT COUNT(DISTINCT cs.challenge_id) as c FROM challenge_submissions cs JOIN challenges ch ON cs.challenge_id = ch.id JOIN competency_nodes cn ON ch.competency_node_id = cn.id WHERE cs.user_id = ? AND cs.status = 'passed' AND cn.goal_id = ?").get(userId, goalId) as any)?.c || 0;

  return { totalNodes, provenNodes, partialNodes, staleNodes, newImpacts, totalChallenges, passedSubmissions };
}
