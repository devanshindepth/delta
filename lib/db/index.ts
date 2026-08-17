import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { SCHEMA_SQL } from "./schema";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "delta.db");
  dbInstance = new Database(dbPath);

  // Enable WAL mode for better concurrency and foreign keys
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");

  // Drop legacy tables from the old adversarial API learning engine
  const legacyTables = [
    "documentation_sources",
    "api_specifications",
    "sandbox_challenges",
    "submission_results",
    "learner_progress",
    "verification_runs",
    "formal_models",
    "protocol_sources",
    "exercises",
  ];

  for (const table of legacyTables) {
    try {
      const exists = dbInstance
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        )
        .get(table);
      if (exists) {
        dbInstance.exec(`DROP TABLE IF EXISTS "${table}"`);
      }
    } catch {
      // ignore
    }
  }

  // Run schema initialization
  dbInstance.exec(SCHEMA_SQL);

  return dbInstance;
}
