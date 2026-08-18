export const SCHEMA_SQL = `
-- Delta Certification Prep Platform Schema

CREATE TABLE IF NOT EXISTS certifications (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  provider TEXT NOT NULL,
  level TEXT NOT NULL,
  official_url TEXT NOT NULL,
  description TEXT,
  icon_prefix TEXT DEFAULT '[~]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_versions (
  id TEXT PRIMARY KEY,
  certification_id TEXT NOT NULL,
  version_code TEXT NOT NULL,
  status TEXT CHECK(status IN ('draft', 'active', 'deprecated', 'retired')) NOT NULL,
  release_date DATETIME,
  retirement_date DATETIME,
  change_summary TEXT,
  FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  exam_version_id TEXT NOT NULL,
  domain_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  weight_percentage_min INTEGER,
  weight_percentage_max INTEGER,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (exam_version_id) REFERENCES exam_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  objective_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  importance TEXT DEFAULT 'medium',
  freshness_status TEXT CHECK(freshness_status IN ('current', 'needs_verification', 'potentially_outdated', 'confirmed_outdated')) DEFAULT 'current',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS practice_questions (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL,
  question_type TEXT NOT NULL,
  difficulty TEXT DEFAULT 'exam',
  stem TEXT NOT NULL,
  options_json TEXT,
  ordering_items_json TEXT,
  matching_pairs_json TEXT,
  case_study_json TEXT,
  sandbox_starter_code TEXT,
  sandbox_test_code TEXT,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  official_doc_url TEXT,
  service_tags TEXT DEFAULT '[]',
  validation_status TEXT DEFAULT 'verified_accurate',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learner_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'user-default',
  objective_id TEXT NOT NULL,
  status TEXT CHECK(status IN ('not_started', 'in_progress', 'mastered', 'needs_review')) DEFAULT 'not_started',
  attempts INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_attempted_at DATETIME,
  mastery_score REAL DEFAULT 0.0,
  UNIQUE(user_id, objective_id),
  FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'user-default',
  question_id TEXT NOT NULL,
  answer_given TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES practice_questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scraped_sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  raw_content TEXT,
  content_hash TEXT,
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  scrape_method TEXT DEFAULT 'native',
  status TEXT CHECK(status IN ('pending', 'success', 'failed')) DEFAULT 'success',
  objective_id TEXT,
  FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS freshness_alerts (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL,
  alert_type TEXT CHECK(alert_type IN ('deprecated', 'updated', 'new_service', 'breaking_change')) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_read INTEGER DEFAULT 0,
  FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
);
`;
