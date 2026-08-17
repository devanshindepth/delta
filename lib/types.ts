// ============================================================
// Delta — Personal Technical Knowledge Engine
// Complete Type System
// ============================================================

// ----------------------------------------------------------
// User & Authentication
// ----------------------------------------------------------

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------
// Goals
// ----------------------------------------------------------

export interface Goal {
  id: string;
  user_id: string;
  title: string; // e.g. "Top-tier AI Engineer"
  description: string;
  status: "active" | "paused" | "completed";
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------
// Competency Graph
// ----------------------------------------------------------

export type EvidenceStatus = "proven" | "partial" | "not_started" | "stale";

export interface CompetencyNode {
  id: string;
  goal_id: string;
  name: string; // e.g. "Transformers"
  category: string; // e.g. "Deep Learning"
  description: string;
  evidence_status: EvidenceStatus;
  confidence: number; // 0.0 - 1.0
  last_proven_at: string | null;
  position_x: number; // for graph layout
  position_y: number;
  created_at: string;
}

export type EdgeRelationship =
  | "prerequisite"
  | "optional"
  | "specialization"
  | "shared";

export interface CompetencyEdge {
  id: string;
  goal_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: EdgeRelationship;
}

export interface CompetencyGraph {
  goal: Goal;
  nodes: CompetencyNode[];
  edges: CompetencyEdge[];
}

// ----------------------------------------------------------
// Evidence Records
// ----------------------------------------------------------

export type EvidenceType =
  | "challenge_passed"
  | "source_mapped"
  | "self_assessed"
  | "project_completed";

export interface EvidenceRecord {
  id: string;
  user_id: string;
  competency_node_id: string;
  evidence_type: EvidenceType;
  details: string;
  confidence_delta: number; // how much confidence this evidence added
  challenge_id?: string;
  source_id?: string;
  created_at: string;
}

// ----------------------------------------------------------
// Technical Changes
// ----------------------------------------------------------

export type ChangeSignificance =
  | "breaking"
  | "new_capability"
  | "deprecated"
  | "new_best_practice"
  | "cosmetic"
  | "documentation";

export type ChangeType =
  | "new_release"
  | "api_change"
  | "framework_update"
  | "model_release"
  | "protocol_change"
  | "tool_update";

export interface TechnicalChange {
  id: string;
  title: string;
  source_url: string;
  source_title: string;
  source_excerpt: string;
  change_type: ChangeType;
  significance: ChangeSignificance;
  summary: string;
  raw_content: string;
  affected_technologies: string[]; // e.g. ["PyTorch", "CUDA"]
  detected_at: string;
  scraped_at: string;
}

// ----------------------------------------------------------
// Change Impact
// ----------------------------------------------------------

export interface ChangeImpact {
  id: string;
  change_id: string;
  competency_node_id: string;
  goal_id: string;
  user_id: string;
  relevance_score: number; // 0.0 - 1.0
  relevance_reason: string; // why this matters to the user
  status: "new" | "acknowledged" | "resolved";
  created_at: string;
}

// ----------------------------------------------------------
// Learning Delta
// ----------------------------------------------------------

export type DeltaStatus = "known" | "partial" | "missing";

export interface LearningDelta {
  id: string;
  user_id: string;
  change_id: string | null;
  competency_node_id: string;
  competency_name: string;
  status: DeltaStatus;
  required_concepts: string[];
  estimated_hours: number;
  created_at: string;
}

export interface LearningDeltaSummary {
  user_id: string;
  change_id: string | null;
  known: LearningDelta[];
  partial: LearningDelta[];
  missing: LearningDelta[];
  total_estimated_hours: number;
}

// ----------------------------------------------------------
// Challenges
// ----------------------------------------------------------

export type ChallengeType =
  | "implement"
  | "debug"
  | "configure"
  | "simulate"
  | "predict"
  | "reproduce"
  | "compare"
  | "optimize"
  | "find_bug"
  | "break_system"
  | "repair_system"
  | "derive"
  | "experiment";

export type ChallengeDifficulty = "beginner" | "intermediate" | "advanced";

export type VerificationMethod =
  | "automated_tests"
  | "property_tests"
  | "output_comparison"
  | "performance_benchmark";

export interface Challenge {
  id: string;
  competency_node_id: string;
  change_id: string | null;
  title: string;
  description: string;
  challenge_type: ChallengeType;
  difficulty: ChallengeDifficulty;
  language: string; // "python", "javascript", "typescript", etc.
  starter_code: string;
  test_code: string; // code that verifies the solution
  expected_output: string | null;
  verification_method: VerificationMethod;
  estimated_minutes: number;
  why_it_matters: string;
  created_at: string;
}

// ----------------------------------------------------------
// Challenge Submissions & Verification
// ----------------------------------------------------------

export type SubmissionStatus = "passed" | "failed" | "error" | "running";

export interface TestResult {
  name: string;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  error?: string;
}

export interface CounterExample {
  input: string;
  your_result: string;
  expected: string;
  failure_trace: string;
  invariant_violated: string;
}

export interface ChallengeSubmission {
  id: string;
  challenge_id: string;
  user_id: string;
  code: string;
  language: string;
  status: SubmissionStatus;
  execution_output: string;
  test_results: TestResult[];
  counterexamples: CounterExample[];
  duration_ms: number;
  submitted_at: string;
}

// ----------------------------------------------------------
// Sources (YouTube, GitHub, Docs, Papers, etc.)
// ----------------------------------------------------------

export type SourceType =
  | "youtube"
  | "github_repo"
  | "documentation"
  | "research_paper"
  | "blog_post"
  | "release_notes"
  | "api_docs"
  | "course"
  | "pdf";

export type IngestionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface Source {
  id: string;
  user_id: string;
  title: string;
  url: string;
  source_type: SourceType;
  raw_content: string;
  extracted_concepts: string[];
  mapped_competency_ids: string[];
  ingestion_status: IngestionStatus;
  scraped_at: string | null;
  created_at: string;
}

// ----------------------------------------------------------
// Heatmap (Capability Evidence Over Time)
// ----------------------------------------------------------

export type HeatmapLevel = "proven" | "partial" | "none" | "stale";

export interface HeatmapEntry {
  date: string; // YYYY-MM-DD
  competency_node_id: string;
  level: HeatmapLevel;
  evidence_count: number;
}

export interface HeatmapDay {
  date: string;
  level: HeatmapLevel;
  count: number;
}

// ----------------------------------------------------------
// API Response Wrappers
// ----------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ----------------------------------------------------------
// Piston Code Execution
// ----------------------------------------------------------

export interface PistonExecuteRequest {
  language: string;
  version: string;
  files: Array<{
    name?: string;
    content: string;
  }>;
  stdin?: string;
  args?: string[];
  compile_timeout?: number;
  run_timeout?: number;
}

export interface PistonExecuteResponse {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
}

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

// ----------------------------------------------------------
// Understand Mode ("I want to understand this")
// ----------------------------------------------------------

export interface UnderstandRequest {
  query: string; // e.g. "DeepSeek V4", a URL, a concept
}

export interface UnderstandResult {
  what_it_is: string;
  what_changed: string;
  prerequisites: string[];
  already_known: string[];
  not_known: string[];
  matters_for_goal: string;
  next_steps: string[];
  proof_method: string;
}
