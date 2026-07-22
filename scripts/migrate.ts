import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/db/schema";

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

const filePath = resolveDbFilePath();
fs.mkdirSync(path.dirname(filePath), { recursive: true });

const sqlite = new Database(filePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

sqlite.close();
console.log("Migrations applied.");
