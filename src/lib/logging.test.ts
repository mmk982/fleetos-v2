/**
 * A-14: logError must not emit Drizzle SQL text or bound params.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const captureException = vi.fn();
const captureMessage = vi.fn();
const setTag = vi.fn();
const setExtra = vi.fn();
const setExtras = vi.fn();

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  withScope: (fn: (scope: {
    setTag: typeof setTag;
    setExtra: typeof setExtra;
    setExtras: typeof setExtras;
  }) => void) => {
    fn({ setTag, setExtra, setExtras });
  },
  captureException: (...args: unknown[]) => captureException(...args),
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}));

import { DrizzleQueryError } from "drizzle-orm/errors";
import { logError, sanitizeLogError } from "./logging";

function pgCause(code: string, constraint?: string): Error {
  return Object.assign(new Error(`pg ${code}`), {
    code,
    ...(constraint ? { constraint } : {}),
  });
}

describe("sanitizeLogError", () => {
  it("strips Drizzle query text and params from a fake DrizzleQueryError", () => {
    const cause = pgCause("23505", "vessels_imo_number_unique");
    const wrapped = new DrizzleQueryError(
      "select * from vessels where id = $1",
      ["secret-uuid-param"],
      cause,
    );

    const sanitized = sanitizeLogError("VESSEL_CREATE_FAILED", wrapped);

    expect(sanitized.operation).toBe("VESSEL_CREATE_FAILED");
    expect(sanitized.sqlstate).toBe("23505");
    expect(sanitized.constraint).toBe("vessels_imo_number_unique");
    expect(sanitized.message).toBe("Database query failed (23505)");
    expect(sanitized.message).not.toMatch(/select/i);
    expect(sanitized.message).not.toMatch(/secret-uuid/);
    expect(JSON.stringify(sanitized)).not.toMatch(/secret-uuid/);
    expect(JSON.stringify(sanitized)).not.toMatch(/select \*/i);
    expect(sanitized.sentryError?.message).toBe("Database query failed (23505)");
    expect(sanitized.sentryError?.message).not.toMatch(/select/i);
    expect(sanitized.sentryError).not.toBe(wrapped);
  });
});

describe("logError", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    errorSpy.mockClear();
    captureException.mockClear();
    captureMessage.mockClear();
    delete process.env.GLITCHTIP_DSN;
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    delete process.env.GLITCHTIP_DSN;
    delete process.env.SENTRY_DSN;
  });

  it("logs SQLSTATE/constraint/operation only for DrizzleQueryError", () => {
    const cause = pgCause("23503", "certificates_vessel_id_vessels_id_fk");
    const wrapped = new DrizzleQueryError(
      "insert into certificates values ($1)",
      ["bound-secret"],
      cause,
    );

    logError("CERTIFICATE_CREATE_FAILED", { error: wrapped, certificateId: "c1" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(errorSpy.mock.calls[0]![0]));
    expect(line.code).toBe("CERTIFICATE_CREATE_FAILED");
    expect(line.operation).toBe("CERTIFICATE_CREATE_FAILED");
    expect(line.sqlstate).toBe("23503");
    expect(line.constraint).toBe("certificates_vessel_id_vessels_id_fk");
    expect(line.message).toBe("Database query failed (23503)");
    expect(line.certificateId).toBe("c1");
    expect(JSON.stringify(line)).not.toMatch(/bound-secret/);
    expect(JSON.stringify(line)).not.toMatch(/insert into/i);
    expect(line.query).toBeUndefined();
    expect(line.params).toBeUndefined();
  });
});
