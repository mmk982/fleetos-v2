/**
 * Safe `Content-Disposition` values for attachment downloads.
 *
 * Strips header-breaking characters and emits both an ASCII `filename`
 * fallback and an RFC 5987 `filename*` form for the original name.
 */

/** Control chars, quotes, and backslashes that must never appear in the header. */
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f"\\]/g;

/** Non-printable ASCII → `_` for the legacy `filename="…"` parameter. */
const NON_PRINTABLE_ASCII = /[^\u0020-\u007e]/g;

/**
 * Builds `inline; filename="<ascii>"; filename*=UTF-8''<encoded>` for downloads.
 */
export function contentDispositionInline(fileName: string): string {
  const cleanName = fileName.replace(UNSAFE_NAME_CHARS, "");
  let ascii = cleanName.replace(NON_PRINTABLE_ASCII, "_");
  if (ascii.length === 0) {
    ascii = "download";
  }

  const encoded = encodeURIComponent(cleanName)
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");

  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
