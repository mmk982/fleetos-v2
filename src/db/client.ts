import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

const defaultRelativePath = "data/fleetos.db";

function resolveDbFilePath(): string {
  const url = process.env.DATABASE_URL;
  if (url?.startsWith("file:")) {
    const raw = url.slice("file:".length);
    return path.isAbsolute(raw)
      ? raw
      : path.join(/* turbopackIgnore: true */ process.cwd(), raw);
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), defaultRelativePath);
}

let sqlite: Database.Database | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const filePath = resolveDbFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  dbInstance = drizzle(sqlite, { schema });
  return dbInstance;
}

export function closeDb() {
  sqlite?.close();
  sqlite = null;
  dbInstance = null;
}
