# Cursor prompt — P1 review fixes (#1 cron, #3 filename header, #4 CI tests)

Scope: ONLY these three changes. No refactors, no other files. Branch: `cursor/rbac-enforcement`.

## 1. Cron endpoint must fail closed — `src/app/api/internal/email-digest/route.ts`

Problem: `auth !== \`Bearer ${process.env.CRON_SECRET}\`` — when `CRON_SECRET` is unset, `Bearer undefined` is accepted.

Do:
- Read `process.env.CRON_SECRET` once per request. If it is missing or shorter than 32 chars → return `401` JSON `{ error: "Unauthorized" }` (do NOT run the digest; do not reveal the reason in the response; `console.error` a short server-side message without the secret).
- Compare with `crypto.timingSafeEqual` on equal-length Buffers (check lengths first; unequal length → 401).
- Keep route shape, `POST`, and the success response unchanged.
- Put the check in a small pure helper (e.g. `isValidCronAuth(header, secret)` in `src/lib/auth/cron-auth.ts`) so it is unit-testable.
- Add `src/lib/auth/cron-auth.test.ts` (vitest) covering: secret undefined + header `Bearer undefined` → false; secret < 32 chars → false; wrong token → false; different length → false; missing header → false; correct token with 32+ chars → true.

## 2. Safe `Content-Disposition` — `src/app/api/attachments/[id]/route.ts` (line ~45)

Problem: only `"` is stripped; non-ASCII (Arabic) names and CR/LF are not handled.

Do:
- Add helper `contentDispositionInline(fileName: string): string` (e.g. in `src/lib/attachments/content-disposition.ts`):
  - strip control chars (`\r`, `\n`, `\0`, etc.) and `"` and `\` from the name;
  - ASCII fallback: replace every non-printable-ASCII char with `_` for `filename="…"` (use `"download"` if empty);
  - add RFC 5987 `filename*=UTF-8''` + `encodeURIComponent(cleanName)` (also percent-encode `'`, `(`, `)`, `*`).
  - Result: `inline; filename="<ascii>"; filename*=UTF-8''<encoded>`.
- Use it in the route; keep `Content-Type` and `Cache-Control` as they are.
- Add `content-disposition.test.ts`: Arabic name, name with `"`, name with `\r\n`, empty name after cleaning, normal ASCII name.

## 3. CI must run tests — `.github/workflows/ci.yml`

- Add a step after Typecheck: `- name: Test` / `run: npm test` (script is `vitest run`).
- Do not change anything else in the workflow.

## Verify (all must pass, paste the real output summary)
```
npx tsc --noEmit
npx eslint .
npx vitest run
```
Report: files changed, test count before/after (baseline is 167 + earlier = confirm the current number), and anything you did NOT do. Do not commit; I will review the diff first.
