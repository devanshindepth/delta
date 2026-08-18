export interface Certification {
  id: string;
  code: string;
  title: string;
  provider: string;
  level: string;
  official_url: string;
  description: string;
  icon_prefix: string;
}

export interface ExamVersion {
  id: string;
  certification_id: string;
  version_code: string;
  status: 'draft' | 'active' | 'retired';
}

export interface Domain {
  id: string;
  version_id: string;
  domain_code: string;
  title: string;
  weight_percentage_min: number;
  weight_percentage_max: number;
  objectives?: Objective[];
}

export type FreshnessStatus = 'current' | 'needs_verification' | 'potentially_outdated' | 'confirmed_outdated';

export interface Objective {
  id: string;
  domain_id: string;
  objective_code: string;
  title: string;
  description: string;
  freshness_status: FreshnessStatus;
}

export interface BlueprintDiff {
  from_version: string;
  to_version: string;
  diff_date: string;
  added_objectives: string[];
  deprecated_objectives: string[];
  notes: string;
}

export interface ChangeEvent {
  id: string;
  title: string;
  summary: string;
  effective_date: string;
  change_type: string;
  severity: 'breaking' | 'notice';
  official_changelog_url: string;
}

export interface Course {
  id: string;
  certification_id: string;
  title: string;
  source_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  alignments?: AlignmentResult[];
}

export interface AlignmentResult {
  id: string;
  course_id: string;
  objective_id: string;
  objective_code?: string;
  objective_title?: string;
  status: 'covered' | 'weak' | 'outdated' | 'missing' | 'not_applicable';
  gap_analysis: string;
  recommendation: string;
  source_content_hash: string;
  confidence_score: number;
}

export type QuestionType = 'mcq' | 'multi_select' | 'sandbox' | 'ordering' | 'matching' | 'case_study';

export interface PracticeQuestion {
  id: string;
  objective_id: string;
  question_type: QuestionType;
  stem: string;
  options_json: string;
  correct_answer: string;
  explanation: string;
}

export interface PracticeAttempt {
  id: string;
  question_id: string;
  is_correct: boolean;
  score_percentage: number;
  feedback: string;
}

export interface QuestionValidationResult {
  is_valid: boolean;
  has_outdated_services: boolean;
}

export type TeachingDepth = 'simply' | 'normally' | 'deeply';
export type TeachingFormat = 'example' | 'diagram' | 'code' | 'analogy';
export type TeachingDifficulty = 'easy' | 'exam' | 'hard';

export interface TeachingStep {
  text: string;
  visual?: string;
}

export interface TeachingSession {
  id: string;
  objective_id: string;
  depth: TeachingDepth;
  format: TeachingFormat;
  steps: TeachingStep[];
}

export interface DomainReadiness {
  domain_code: string;
  score: number;
}

export interface ReadinessScore {
  overall_readiness_score: number;
  pass_probability: number;
  domain_breakdown: DomainReadiness[];
  outdated_risks: string[];
}

export interface SourceProvenance {
  source_url: string;
  content_hash: string;
}

export type InsightCategory = 'VERIFIED' | 'INFERRED' | 'UNCERTAIN' | 'OUTDATED';

export interface SourceClaim {
  text: string;
}
