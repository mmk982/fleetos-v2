import { describe, expect, it } from "vitest";
import { uuidSearchParam } from "./search-params";

describe("uuidSearchParam", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";

  it("passes a well-formed UUID through", () => {
    expect(uuidSearchParam(id)).toBe(id);
    expect(uuidSearchParam(id.toUpperCase())).toBe(id.toUpperCase());
  });

  it("drops missing, empty and malformed values", () => {
    expect(uuidSearchParam(undefined)).toBeUndefined();
    expect(uuidSearchParam("")).toBeUndefined();
    expect(uuidSearchParam("abc")).toBeUndefined();
    expect(uuidSearchParam(`${id}x`)).toBeUndefined();
    expect(uuidSearchParam(`${id}' OR 1=1`)).toBeUndefined();
  });
});
