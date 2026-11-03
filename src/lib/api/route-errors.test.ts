import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ForbiddenError } from "@/lib/auth/access";
import {
  invalidUuidResponse,
  isUuidParam,
  mapGetError,
} from "./route-errors";

describe("isUuidParam", () => {
  it("accepts a well-formed uuid", () => {
    expect(isUuidParam("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(isUuidParam("not-a-uuid")).toBe(false);
    expect(isUuidParam("")).toBe(false);
    expect(isUuidParam("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeeeX")).toBe(false);
  });
});

describe("invalidUuidResponse", () => {
  it("returns 404 JSON", async () => {
    const res = invalidUuidResponse("Vessel not found");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Vessel not found" });
  });
});

describe("mapGetError", () => {
  it("maps ForbiddenError to 403", async () => {
    const res = mapGetError(new ForbiddenError("nope"));
    expect(res?.status).toBe(403);
    await expect(res!.json()).resolves.toEqual({ error: "nope" });
  });

  it("maps *NotFoundError by name to 404", async () => {
    const err = Object.assign(new Error("missing"), {
      name: "VesselNotFoundError",
    });
    const res = mapGetError(err);
    expect(res?.status).toBe(404);
    await expect(res!.json()).resolves.toEqual({ error: "missing" });
  });

  it("maps SQLSTATE 22P02 to 404", async () => {
    const err = Object.assign(new Error("invalid input syntax for type uuid"), {
      code: "22P02",
    });
    const res = mapGetError(err);
    expect(res?.status).toBe(404);
    await expect(res!.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns null for unknown errors", () => {
    expect(mapGetError(new Error("boom"))).toBeNull();
  });
});
