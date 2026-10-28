/**
 * Content-Disposition header builder for attachment downloads.
 */
import { describe, expect, it } from "vitest";
import { contentDispositionInline } from "./content-disposition";

describe("contentDispositionInline", () => {
  it("keeps Arabic characters in filename* and underscores them in filename", () => {
    expect(contentDispositionInline("شهادة.pdf")).toBe(
      `inline; filename="_____.pdf"; filename*=UTF-8''${encodeURIComponent("شهادة.pdf")}`,
    );
  });

  it("strips double quotes from the name", () => {
    expect(contentDispositionInline('report "final".pdf')).toBe(
      'inline; filename="report final.pdf"; filename*=UTF-8\'\'report%20final.pdf',
    );
  });

  it("strips CR/LF so they cannot split the header", () => {
    expect(contentDispositionInline("evil\r\nName.pdf")).toBe(
      'inline; filename="evilName.pdf"; filename*=UTF-8\'\'evilName.pdf',
    );
  });

  it("falls back to download when cleaning leaves an empty ASCII name", () => {
    expect(contentDispositionInline('"""')).toBe(
      "inline; filename=\"download\"; filename*=UTF-8''",
    );
  });

  it("passes through a normal ASCII name unchanged", () => {
    expect(contentDispositionInline("survey-report.pdf")).toBe(
      'inline; filename="survey-report.pdf"; filename*=UTF-8\'\'survey-report.pdf',
    );
  });
});
