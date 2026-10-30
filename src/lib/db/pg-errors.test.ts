import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  getPgConstraintName,
  getPgErrorCode,
  isPgForeignKeyViolation,
  isPgInsufficientPrivilege,
  isPgInvalidTextRepresentation,
  isPgRlsViolation,
  isPgUniqueViolation,
} from "./pg-errors";

function pgShaped(code: string, constraint?: string): Error {
  return Object.assign(new Error(`pg ${code}`), {
    code,
    ...(constraint ? { constraint } : {}),
  });
}

describe("getPgErrorCode", () => {
  it("reads code from a plain pg-shaped error", () => {
    expect(getPgErrorCode(pgShaped("23505"))).toBe("23505");
  });

  it("reads code from DrizzleQueryError.cause", () => {
    const cause = pgShaped("23503", "certificates_vessel_id_vessels_id_fk");
    const wrapped = new DrizzleQueryError("select 1", [], cause);
    expect(getPgErrorCode(wrapped)).toBe("23503");
  });

  it("reads code through double wrapping", () => {
    const inner = pgShaped("23505");
    const mid = new DrizzleQueryError("inner", [], inner);
    const outer = new DrizzleQueryError("outer", [], mid);
    expect(getPgErrorCode(outer)).toBe("23505");
  });

  it("returns undefined for unrelated errors / null / non-objects", () => {
    expect(getPgErrorCode(new Error("nope"))).toBeUndefined();
    expect(getPgErrorCode(null)).toBeUndefined();
    expect(getPgErrorCode(undefined)).toBeUndefined();
    expect(getPgErrorCode("23505")).toBeUndefined();
    expect(getPgErrorCode({ code: "not-a-sqlstate" })).toBeUndefined();
  });

  it("tolerates circular cause chains", () => {
    const a: { cause?: unknown; code?: string } = {};
    const b: { cause?: unknown } = { cause: a };
    a.cause = b;
    expect(getPgErrorCode(a)).toBeUndefined();
  });
});

describe("getPgConstraintName", () => {
  it("reads constraint from a nested DrizzleQueryError", () => {
    const cause = pgShaped("23503", "vessels_imo_number_unique");
    const wrapped = new DrizzleQueryError("q", [], cause);
    expect(getPgConstraintName(wrapped)).toBe("vessels_imo_number_unique");
  });
});

describe("isPg*Violation helpers", () => {
  it("detects unique / FK / invalid text on wrapped errors", () => {
    expect(
      isPgUniqueViolation(new DrizzleQueryError("q", [], pgShaped("23505"))),
    ).toBe(true);
    expect(
      isPgForeignKeyViolation(
        new DrizzleQueryError("q", [], pgShaped("23503")),
      ),
    ).toBe(true);
    expect(
      isPgInvalidTextRepresentation(
        new DrizzleQueryError("q", [], pgShaped("22P02")),
      ),
    ).toBe(true);
  });

  it("returns false when the outer error has no nested SQLSTATE", () => {
    expect(isPgUniqueViolation(new Error("plain"))).toBe(false);
    expect(isPgForeignKeyViolation({ code: "23505" })).toBe(false);
    expect(isPgUniqueViolation({ code: "23503" })).toBe(false);
  });

  it("still matches when code is on the outer object (legacy shape)", () => {
    expect(isPgUniqueViolation(pgShaped("23505"))).toBe(true);
    expect(isPgForeignKeyViolation(pgShaped("23503"))).toBe(true);
  });

  it("detects 42501 insufficient_privilege / RLS via Drizzle wrapping", () => {
    const wrapped = new DrizzleQueryError("q", [], pgShaped("42501"));
    expect(isPgInsufficientPrivilege(wrapped)).toBe(true);
    expect(isPgRlsViolation(wrapped)).toBe(true);
    expect(isPgInsufficientPrivilege(pgShaped("42501"))).toBe(true);
    expect(isPgRlsViolation(new Error("plain"))).toBe(false);
    expect(isPgRlsViolation(pgShaped("23505"))).toBe(false);
  });
});
