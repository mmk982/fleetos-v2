/**
 * Server-to-server trigger for the daily Admin email digest.
 *
 * Phase 7 provisioning adds a VPS crontab entry, e.g.:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://…/api/internal/email-digest
 */
import { NextResponse } from "next/server";
import { runEmailDigest } from "@/modules/email-digest/email-digest.controller";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runEmailDigest();
  return NextResponse.json(result);
}
