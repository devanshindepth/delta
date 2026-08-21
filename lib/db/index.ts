import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { SCHEMA_SQL } from "./schema";
import { seedDataIfEmpty } from "./seed";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const isVercel = Boolean(process.env.VERCEL);
  const dataDir = isVercel ? "/tmp" : path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "delta-saas.db");

  // On Vercel, copy pre-built database from repository if available
  if (isVercel && !fs.existsSync(dbPath)) {
    const bundledDbPath = path.join(process.cwd(), "data", "delta-saas.db");
    if (fs.existsSync(bundledDbPath)) {
      try {
        fs.copyFileSync(bundledDbPath, dbPath);
      } catch (e) {
        console.warn("[getDb] Could not copy bundled DB to /tmp:", e);
      }
    }
  }

  dbInstance = new Database(dbPath);

  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("busy_timeout = 10000");
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.pragma("synchronous = NORMAL");

  dbInstance.exec(SCHEMA_SQL);
  seedDataIfEmpty(dbInstance);

  return dbInstance;
}
