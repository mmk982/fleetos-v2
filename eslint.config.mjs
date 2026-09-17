import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ECC / Cursor tooling (CommonJS scripts) — not app source.
    ".cursor/**",
    // Legacy Laravel scaffold — not linted by the Next.js ESLint stack.
    "backend/**",
  ]),
]);

export default eslintConfig;
