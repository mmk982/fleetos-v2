/**
 * Server Actions for Auth — login boundary between the login form and
 * `password.ts` / `session.ts` (`MASTER_IMPLEMENTATION_PLAN.md` Phase 3).
 */
"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import {
  clearLoginFailuresForAccount,
  isLoginRateLimited,
  recordLoginFailure,
} from "@/lib/auth/login-rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import {
  assertSameOriginMutation,
  getRequestIp,
} from "@/lib/auth/request-guard";
import { createSession, destroySession } from "@/lib/auth/session";
import { loginSchema } from "./validation";

/**
 * `redirect()` throws a special Next.js error — rethrow it from any
 * `try`/`catch` so the redirect is not swallowed as a login failure.
 */
function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

/**
 * Generic failure copy — never reveal whether email/password was wrong or
 * whether rate limiting / backoff applied (`SECURITY_PLAN.md` §2.4).
 */
const INVALID_CREDENTIALS = "Invalid email or password.";

/**
 * `useActionState` result for the login form. Success always `redirect`s;
 * only failures return state to the client.
 */
export type LoginActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/** Reads a `FormData` field as a string, or `undefined` if absent. */
function readFormString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) {
    return undefined;
  }
  return String(v);
}

/**
 * Authenticates with email/password, creates a session cookie, and redirects
 * to `/dashboard`. Credential, rate-limit, and backoff failures all return
 * {@link INVALID_CREDENTIALS}.
 */
export async function loginAction(
  _prev: LoginActionState | undefined,
  formData: FormData,
): Promise<LoginActionState> {
  await assertSameOriginMutation();

  const parsed = loginSchema.safeParse({
    email: readFormString(formData, "email") ?? "",
    password: readFormString(formData, "password") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const pathKey = issue.path[0];
      if (typeof pathKey === "string") {
        fieldErrors[pathKey] ??= [];
        fieldErrors[pathKey].push(issue.message);
      }
    }
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const { email, password } = parsed.data;
  const ip = await getRequestIp();

  if (isLoginRateLimited(email, ip)) {
    return { ok: false, message: INVALID_CREDENTIALS };
  }

  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];

  // Same generic error whether the email is unknown, the password is wrong,
  // or the account is deactivated (SECURITY_PLAN.md §2.4 — no enumeration).
  if (
    !user ||
    !user.isActive ||
    !(await verifyPassword(user.passwordHash, password))
  ) {
    recordLoginFailure(email, ip);
    return { ok: false, message: INVALID_CREDENTIALS };
  }

  clearLoginFailuresForAccount(email);

  try {
    // Drop any prior session for this browser before issuing a fresh one
    // (session-ID rotation on login — SECURITY_PLAN.md §3).
    await destroySession();
    await createSession(user.id);
    redirect("/dashboard");
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    throw error;
  }
}
