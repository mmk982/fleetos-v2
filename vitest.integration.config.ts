import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Real-Postgres RLS suite. Not part of `npm test`.
 * Skips (exit 0 with message) when the DB is unreachable — see setup file.
 *
 * Vitest 5: `poolOptions.forks.singleFork` removed — use `fileParallelism: false`
 * (forces maxWorkers=1) with `pool: "forks"`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
