import { defineConfig } from "drizzle-kit";
import { resolveMigrateDatabaseUrl } from "./src/db/urls";

const { url } = resolveMigrateDatabaseUrl();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
