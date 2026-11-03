/**
 * Shared attachment file streaming helpers (SECURITY_PLAN.md §6).
 *
 * On-disk paths are always taken from a DB row, never from the request.
 * Used by the generic `/api/attachments/[id]` route and by each module's
 * upload/delete path when removing files.
 */
import "server-only";

import { accessSync, constants, createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { logError } from "@/lib/logging";

/** Thrown when the on-disk file is missing (A-15) — map to HTTP 404. */
export class AttachmentFileMissingError extends Error {
  readonly code = "ATTACHMENT_FILE_MISSING" as const;
  constructor(relativePath: string) {
    super(`Attachment file missing: ${relativePath}`);
    this.name = "AttachmentFileMissingError";
  }
}

function attachmentsRoot(): string {
  return path.resolve(process.cwd(), "data", "attachments");
}

/** Absolute path under `data/attachments/`, or `null` if the relative path escapes. */
export function resolveAttachmentAbsolutePath(
  relativePath: string,
): string | null {
  const root = attachmentsRoot();
  const absolute = path.resolve(process.cwd(), relativePath);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    return null;
  }
  return absolute;
}

/**
 * Opens a read stream for a DB-stored relative path after a path-escape check
 * and a pre-flight `access` so missing files fail before headers are sent.
 *
 * @throws when the path escapes `data/attachments/`.
 * @throws {AttachmentFileMissingError} when the file is not readable.
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

  try {
    accessSync(absolute, constants.R_OK);
  } catch {
    throw new AttachmentFileMissingError(relativePath);
  }

  const stream = createReadStream(absolute);
  // Headers may already be flushed if a rare race deletes the file between
  // access and open, or the disk fails mid-stream — destroy safely and log.
  stream.on("error", (error) => {
    logError("ATTACHMENT_STREAM_ERROR", { error, filePath: relativePath });
    stream.destroy();
  });

  return { stream, absolutePath: absolute };
}

/** Best-effort delete of an on-disk attachment file (A-21: ignore ENOENT only). */
export async function removeStoredAttachmentFile(
  relativePath: string,
): Promise<void> {
  const absolute = resolveAttachmentAbsolutePath(relativePath);
  if (!absolute) return;
  try {
    await unlink(absolute);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    ) {
      return;
    }
    logError("ATTACHMENT_FILE_DELETE_FAILED", { error, filePath: relativePath });
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
