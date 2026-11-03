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
  ]),
  // A-11: `db.transaction()` on a withDb PoolClient COMMITs the outer RLS
  // transaction. App code must use `withNestedTransaction` instead.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/db/client.ts", "src/**/*.test.ts", "src/**/*.integration.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='transaction']",
          message:
            "Do not call .transaction() under withDb — it COMMITs the outer RLS txn. Use withNestedTransaction from @/db/client.",
        },
      ],
    },
  },
]);

export default eslintConfig;
