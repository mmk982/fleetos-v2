/**
 * Outbound email via Resend (`PROJECT_PLAN.md` §12b).
 * No-ops (with log) when `RESEND_API_KEY` is unset — safe for local dev.
 */
import "server-only";

import { Resend } from "resend";
import { logError } from "@/lib/logging";

export type SendEmailInput = { to: string; subject: string; text: string };

/**
 * Sends a plain-text email. Returns without throwing when the API key is
 * missing; provider failures are thrown for the caller to handle.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    logError("EMAIL_SEND_SKIPPED_NO_API_KEY", {
      to: input.to,
      subject: input.subject,
    });
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    logError("EMAIL_SEND_SKIPPED_NO_FROM", {
      to: input.to,
      subject: input.subject,
    });
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  if (error) {
    throw new Error(error.message ?? "Resend send failed");
  }
}
