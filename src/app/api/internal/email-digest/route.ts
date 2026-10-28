/**
 * Server-to-server trigger for the daily Admin email digest.
 *
 * Phase 7 provisioning adds a VPS crontab entry, e.g.:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://…/api/internal/email-digest
 */
import { NextResponse } from "next/server";
import { isValidCronAuth } from "@/lib/auth/cron-auth";
import { runEmailDigest } from "@/modules/email-digest/email-digest.controller";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!isValidCronAuth(auth, secret)) {
    if (secret == null || secret.length < 32) {
      console.error("CRON_SECRET is missing or too short — rejecting cron request");
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runEmailDigest();
  return NextResponse.json(result);
}
