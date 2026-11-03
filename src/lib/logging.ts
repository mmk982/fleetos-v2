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
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  getPgConstraintName,
  getPgErrorCode,
} from "@/lib/db/pg-errors";

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

function isDrizzleQueryError(error: unknown): error is DrizzleQueryError {
  if (error instanceof DrizzleQueryError) return true;
  // Duck-type for cases where the class identity differs across bundles.
  return (
    typeof error === "object" &&
    error !== null &&
    "query" in error &&
    "params" in error &&
    typeof (error as { query: unknown }).query === "string"
  );
}

/**
 * Builds console / Sentry-safe fields for a thrown value.
 *
 * DrizzleQueryError embeds SQL text and bound params in `message` (and on
 * `.query` / `.params`). Those must never reach logs or GlitchTip — only
 * SQLSTATE, constraint name, the operation code, and a sanitized message.
 */
export function sanitizeLogError(
  operation: string,
  thrown: unknown,
): {
  message?: string;
  name?: string;
  sqlstate?: string;
  constraint?: string;
  operation: string;
  sentryError?: Error;
} {
  if (!(thrown instanceof Error) && !isDrizzleQueryError(thrown)) {
    return { operation };
  }

  if (isDrizzleQueryError(thrown)) {
    const sqlstate = getPgErrorCode(thrown);
    const constraint = getPgConstraintName(thrown);
    const message = sqlstate
      ? `Database query failed (${sqlstate})`
      : "Database query failed";
    const sentryError = new Error(message);
    sentryError.name = "DrizzleQueryError";
    return {
      operation,
      message,
      name: "DrizzleQueryError",
      ...(sqlstate ? { sqlstate } : {}),
      ...(constraint ? { constraint } : {}),
      sentryError,
    };
  }

  const err = thrown as Error;
  return {
    operation,
    message: err.message,
    name: err.name,
    sentryError: err,
  };
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
    context.error instanceof Error || isDrizzleQueryError(context.error)
      ? context.error
      : context.err instanceof Error || isDrizzleQueryError(context.err)
        ? context.err
        : undefined;

  const rest: Record<string, unknown> = { ...context };
  delete rest.error;
  delete rest.err;

  const sanitized = sanitizeLogError(code, thrown);
  const line: Record<string, unknown> = {
    level: "error",
    code,
    ...rest,
    operation: sanitized.operation,
    ts: new Date().toISOString(),
  };
  if (sanitized.message !== undefined) line.message = sanitized.message;
  if (sanitized.name !== undefined) line.name = sanitized.name;
  if (sanitized.sqlstate !== undefined) line.sqlstate = sanitized.sqlstate;
  if (sanitized.constraint !== undefined) line.constraint = sanitized.constraint;

  console.error(JSON.stringify(line));

  try {
    if (!ensureSentry()) {
      return;
    }
    Sentry.withScope((scope) => {
      scope.setTag("fleetos.code", code);
      scope.setTag("fleetos.operation", code);
      if (sanitized.sqlstate) scope.setTag("fleetos.sqlstate", sanitized.sqlstate);
      if (sanitized.constraint) {
        scope.setExtra("constraint", sanitized.constraint);
      }
      const extras: Record<string, unknown> = { ...rest };
      // Never forward raw Drizzle query/params via extras.
      delete extras.query;
      delete extras.params;
      scope.setExtras(extras);
      if (sanitized.sentryError) {
        Sentry.captureException(sanitized.sentryError);
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
