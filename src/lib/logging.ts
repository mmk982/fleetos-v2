/**
 * Shared logging seam — every module's `<singular>.controller.ts` calls
 * {@link logError} from catch blocks that surface unexpected failures
 * (`PROJECT_PLAN.md` Conventions / `MASTER_IMPLEMENTATION_PLAN.md` Task 2.3).
 *
 * Always writes a structured JSON line to stderr. When `GLITCHTIP_DSN` (or
 * legacy alias `SENTRY_DSN`) is set, also reports to GlitchTip via the
 * Sentry-compatible `@sentry/node` SDK. Logging must never throw into the
 * request path — report failures are swallowed after a best-effort console
 * fallback.
 */
import "server-only";

import * as Sentry from "@sentry/node";

let sentryInitialized = false;

/** Lazily initializes Sentry/GlitchTip once per process when a DSN is present. */
function ensureSentry(): boolean {
  if (sentryInitialized) {
    return Boolean(process.env.GLITCHTIP_DSN?.trim() || process.env.SENTRY_DSN?.trim());
  }
  sentryInitialized = true;

  const dsn = process.env.GLITCHTIP_DSN?.trim() || process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Error tracking only for now — tracing belongs with a later perf pass.
    tracesSampleRate: 0,
  });
  return true;
}

/**
 * Records an unexpected controller/DB-boundary failure.
 *
 * @param code - Stable machine-readable tag (e.g. `VESSEL_CREATE_FAILED`) —
 *   used as the GlitchTip tag `fleetos.code` and in the console line.
 * @param context - Structured extras. Pass the thrown value as `error` when
 *   available so the stack reaches GlitchTip; avoid raw secrets/passwords.
 */
export function logError(code: string, context: Record<string, unknown> = {}): void {
  const thrown =
    context.error instanceof Error
      ? context.error
      : context.err instanceof Error
        ? context.err
        : undefined;

  const rest: Record<string, unknown> = { ...context };
  delete rest.error;
  delete rest.err;

  const line: Record<string, unknown> = {
    level: "error",
    code,
    ...rest,
    ts: new Date().toISOString(),
  };
  if (thrown) {
    line.message = thrown.message;
    line.name = thrown.name;
  }

  console.error(JSON.stringify(line));

  try {
    if (!ensureSentry()) {
      return;
    }
    Sentry.withScope((scope) => {
      scope.setTag("fleetos.code", code);
      scope.setExtras(rest);
      if (thrown) {
        Sentry.captureException(thrown);
      } else {
        Sentry.captureMessage(code, "error");
      }
    });
  } catch (reportError) {
    console.error(
      JSON.stringify({
        level: "error",
        code: "LOG_ERROR_REPORT_FAILED",
        message: reportError instanceof Error ? reportError.message : String(reportError),
        ts: new Date().toISOString(),
      }),
    );
  }
}
