export const SCHEMA_SQL = `
-- ============================================================
-- Delta — Personal Technical Knowledge Engine
-- Database Schema
-- ============================================================

-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Competency Nodes (vertices in the dependency graph)
CREATE TABLE IF NOT EXISTS competency_nodes (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  evidence_status TEXT NOT NULL DEFAULT 'not_started',
  confidence REAL NOT NULL DEFAULT 0.0,
  last_proven_at TEXT,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE CASCADE
);

-- Competency Edges (relationships between nodes)
CREATE TABLE IF NOT EXISTS competency_edges (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'prerequisite',
  FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE CASCADE,
  FOREIGN KEY (source_node_id) REFERENCES competency_nodes (id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES competency_nodes (id) ON DELETE CASCADE
);

-- Evidence Records (proof of competency)
CREATE TABLE IF NOT EXISTS evidence_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  competency_node_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  confidence_delta REAL NOT NULL DEFAULT 0.0,
  challenge_id TEXT,
  source_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (competency_node_id) REFERENCES competency_nodes (id) ON DELETE CASCADE
);

-- Technical Changes (detected change events)
CREATE TABLE IF NOT EXISTS technical_changes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  source_title TEXT NOT NULL DEFAULT '',
  source_excerpt TEXT NOT NULL DEFAULT '',
  change_type TEXT NOT NULL,
  significance TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  raw_content TEXT NOT NULL DEFAULT '',
  affected_technologies TEXT NOT NULL DEFAULT '[]',
  detected_at TEXT NOT NULL,
  scraped_at TEXT NOT NULL
);

-- Change Impacts (how a change affects a user's competencies)
CREATE TABLE IF NOT EXISTS change_impacts (
  id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL,
  competency_node_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  relevance_score REAL NOT NULL DEFAULT 0.0,
  relevance_reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  FOREIGN KEY (change_id) REFERENCES technical_changes (id) ON DELETE CASCADE,
  FOREIGN KEY (competency_node_id) REFERENCES competency_nodes (id) ON DELETE CASCADE
);

-- Learning Deltas (computed knowledge gaps)
CREATE TABLE IF NOT EXISTS learning_deltas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  change_id TEXT,
  competency_node_id TEXT NOT NULL,
  competency_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'missing',
  required_concepts TEXT NOT NULL DEFAULT '[]',
  estimated_hours REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (competency_node_id) REFERENCES competency_nodes (id) ON DELETE CASCADE
);

-- Challenges (executable verification tasks)
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  competency_node_id TEXT NOT NULL,
  change_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  challenge_type TEXT NOT NULL DEFAULT 'implement',
  difficulty TEXT NOT NULL DEFAULT 'intermediate',
  language TEXT NOT NULL DEFAULT 'python',
  starter_code TEXT NOT NULL DEFAULT '',
  test_code TEXT NOT NULL DEFAULT '',
  expected_output TEXT,
  verification_method TEXT NOT NULL DEFAULT 'automated_tests',
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  why_it_matters TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (competency_node_id) REFERENCES competency_nodes (id) ON DELETE CASCADE
);

-- Challenge Submissions (user code submissions + verification results)
CREATE TABLE IF NOT EXISTS challenge_submissions (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'python',
  status TEXT NOT NULL DEFAULT 'running',
  execution_output TEXT NOT NULL DEFAULT '',
  test_results TEXT NOT NULL DEFAULT '[]',
  counterexamples TEXT NOT NULL DEFAULT '[]',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL,
  FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE
);

-- Sources (ingested content: YouTube, GitHub, docs, papers, etc.)
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'documentation',
  raw_content TEXT NOT NULL DEFAULT '',
  extracted_concepts TEXT NOT NULL DEFAULT '[]',
  mapped_competency_ids TEXT NOT NULL DEFAULT '[]',
  ingestion_status TEXT NOT NULL DEFAULT 'pending',
  scraped_at TEXT,
  created_at TEXT NOT NULL
);

-- Heatmap Entries (capability evidence over time, NOT activity streaks)
CREATE TABLE IF NOT EXISTS heatmap_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  competency_node_id TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'none',
  evidence_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (competency_node_id) REFERENCES competency_nodes (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_goal ON competency_nodes(goal_id);
CREATE INDEX IF NOT EXISTS idx_edges_goal ON competency_edges(goal_id);
CREATE INDEX IF NOT EXISTS idx_evidence_user ON evidence_records(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_node ON evidence_records(competency_node_id);
CREATE INDEX IF NOT EXISTS idx_changes_detected ON technical_changes(detected_at);
CREATE INDEX IF NOT EXISTS idx_impacts_change ON change_impacts(change_id);
CREATE INDEX IF NOT EXISTS idx_impacts_user ON change_impacts(user_id);
CREATE INDEX IF NOT EXISTS idx_deltas_user ON learning_deltas(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_node ON challenges(competency_node_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON challenge_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_user ON sources(user_id);
CREATE INDEX IF NOT EXISTS idx_heatmap_user_date ON heatmap_entries(user_id, date);
`;
