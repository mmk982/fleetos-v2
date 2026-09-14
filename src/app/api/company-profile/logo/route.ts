/**
 * Public company logo stream — used on login and dashboard top bar.
 * Path comes only from the company_profile DB row.
 */
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import {
  contentTypeForAttachment,
  openStoredAttachmentStream,
} from "@/lib/attachments/stream";
import { getCompanyProfile } from "@/modules/settings/company-profile.controller";

export async function GET() {
  const profile = await getCompanyProfile();
  if (!profile.logoPath) {
    return NextResponse.json({ error: "No logo" }, { status: 404 });
  }

  try {
    const { stream } = openStoredAttachmentStream(profile.logoPath);
    const webStream = Readable.toWeb(
      stream as import("node:stream").Readable,
    ) as ReadableStream;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForAttachment(profile.logoPath, "logo"),
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  }
}
