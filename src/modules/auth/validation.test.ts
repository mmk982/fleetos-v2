/**
 * Auth login schema — email normalisation for case-insensitive login.
 */
import { describe, expect, it } from "vitest";
import { loginSchema } from "./validation";

describe("loginSchema", () => {
  it("trims and lowercases email so login matches stored addresses", () => {
    const parsed = loginSchema.parse({
      email: "  Ops.User@FleetOS.Example ",
      password: "secret",
    });
    expect(parsed.email).toBe("ops.user@fleetos.example");
  });
});
