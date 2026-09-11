/**
 * Zod schemas for the Auth module's Server Actions.
 *
 * Login deliberately validates shape only — never whether the email exists.
 * Credential failures stay a single generic message in `actions.ts`
 * (`SECURITY_PLAN.md` §2.4 — no user enumeration).
 */
import { z } from "zod";

/** Email + password as submitted by the login `<form>`. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(320),
  // Length floor matches SECURITY_PLAN.md §2.2 (12+); composition rules intentionally absent.
  password: z.string().min(1, "Password is required").max(200),
});

/** Parsed login credentials accepted by `loginAction`. */
export type LoginInput = z.infer<typeof loginSchema>;
