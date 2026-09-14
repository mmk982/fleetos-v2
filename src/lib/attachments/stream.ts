/**
 * Shared attachment file streaming helpers (SECURITY_PLAN.md §6).
 *
 * On-disk paths are always taken from a DB row, never from the request.
 * Used by the generic `/api/attachments/[id]` route and by each module's
 * upload/delete path when removing files.
 */
import "server-only";

import { createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { logError } from "@/lib/logging";

const ATTACHMENTS_ROOT = path.resolve(process.cwd(), "data", "attachments");

/** Absolute path under `data/attachments/`, or `null` if the relative path escapes. */
export function resolveAttachmentAbsolutePath(
  relativePath: string,
): string | null {
  const absolute = path.resolve(process.cwd(), relativePath);
  if (
    !absolute.startsWith(ATTACHMENTS_ROOT + path.sep) &&
    absolute !== ATTACHMENTS_ROOT
  ) {
    return null;
  }
  return absolute;
}

/**
 * Opens a read stream for a DB-stored relative path after a path-escape check.
 *
 * @throws when the path escapes `data/attachments/`.
 */
export function openStoredAttachmentStream(relativePath: string): {
  stream: NodeJS.ReadableStream;
  absolutePath: string;
} {
  const absolute = resolveAttachmentAbsolutePath(relativePath);
  if (!absolute) {
    logError("ATTACHMENT_PATH_ESCAPE", { filePath: relativePath });
    throw new Error("Attachment path rejected");
  }
  return { stream: createReadStream(absolute), absolutePath: absolute };
}

/** Best-effort delete of an on-disk attachment file. */
export async function removeStoredAttachmentFile(
  relativePath: string,
): Promise<void> {
  const absolute = resolveAttachmentAbsolutePath(relativePath);
  if (!absolute) return;
  try {
    await unlink(absolute);
  } catch {
    // Already gone — ignore.
  }
}

/** MIME guess from stored path / display name. */
export function contentTypeForAttachment(
  filePath: string,
  fileName: string,
): string {
  const lower = (filePath || fileName).toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
