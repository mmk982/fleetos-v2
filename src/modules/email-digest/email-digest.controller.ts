/**
 * Daily Admin email digest of actionable alerts (`PROJECT_PLAN.md` §12b).
 */
import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emailDeliveries, users } from "@/db/schema";
import type { AccessContext } from "@/lib/auth/access";
import { sendEmail } from "@/lib/email/send";
import { STATUS_LABELS } from "@/lib/expiry";
import { logError } from "@/lib/logging";
import { getEmailDigestEnabled } from "@/lib/settings/email-digest";
import { getAlerts } from "@/modules/alerts/alerts.controller";
import type { AlertItem } from "@/modules/alerts/alerts.model";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
}

function buildDigestBody(alerts: AlertItem[]): string {
  const base = appBaseUrl();
  const lines = alerts.map((a) => {
    const vessel = a.vesselName ?? "Fleet-wide";
    const status = STATUS_LABELS[a.status];
    const link = `${base}${a.href}`;
    return `${a.title} · ${vessel} · ${status} · ${link}`;
  });
  return [
    "FleetOS daily compliance digest",
    "",
    ...lines,
    "",
    "—",
    "This email was sent because Email digest is enabled in Settings.",
  ].join("\n");
}

/**
 * Sends today's digest to every active Admin (once per recipient per day).
 */
export async function runEmailDigest(): Promise<{
  sent: number;
  skipped: number;
}> {
  if (!(await getEmailDigestEnabled())) {
    return { sent: 0, skipped: 0 };
  }

  const admins = await getDb()
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

  if (admins.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  const firstAdmin = admins[0]!;
  const ctx: AccessContext = {
    userId: firstAdmin.id,
    role: firstAdmin.role,
    vesselId: null,
  };
  const alerts = await getAlerts(ctx);
  const digestDate = todayIsoDate();

  if (alerts.length === 0) {
    return { sent: 0, skipped: admins.length };
  }

  const subject = `FleetOS — ${alerts.length} compliance alert(s)`;
  const text = buildDigestBody(alerts);
  const db = getDb();

  let sent = 0;
  let skipped = 0;

  for (const admin of admins) {
    try {
      const existing = await db
        .select({ id: emailDeliveries.id })
        .from(emailDeliveries)
        .where(
          and(
            eq(emailDeliveries.recipientUserId, admin.id),
            eq(emailDeliveries.digestDate, digestDate),
          ),
        )
        .limit(1);
      if (existing[0]) {
        skipped += 1;
        continue;
      }

      await sendEmail({ to: admin.email, subject, text });

      await db.insert(emailDeliveries).values({
        recipientUserId: admin.id,
        digestDate,
      });
      sent += 1;
    } catch (error) {
      logError("EMAIL_DIGEST_RECIPIENT_FAILED", {
        error,
        recipientUserId: admin.id,
        digestDate,
      });
    }
  }

  return { sent, skipped };
}
