import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { SCHEMA_SQL } from "./schema";
import { seedDataIfEmpty } from "./seed";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "delta-saas.db");
  dbInstance = new Database(dbPath);

  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("busy_timeout = 10000");
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.pragma("synchronous = NORMAL");

  dbInstance.exec(SCHEMA_SQL);
  seedDataIfEmpty(dbInstance);

  return dbInstance;
}
