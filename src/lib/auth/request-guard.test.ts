/**
 * Tests for request-guard (origin checks + trusted-proxy IP extraction).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const headerStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerStore.get(name.toLowerCase()) ?? null,
  }),
}));

import {
  assertSameOriginMutation,
  CrossOriginRequestError,
  getRequestIp,
  rejectCrossOrigin,
  resetTrustedProxyHopsWarningForTests,
  warnTrustedProxyHopsIfNeeded,
} from "@/lib/auth/request-guard";

function setHeaders(entries: Record<string, string | undefined>) {
  headerStore.clear();
  for (const [k, v] of Object.entries(entries)) {
    if (v !== undefined) headerStore.set(k.toLowerCase(), v);
  }
}

describe("assertSameOriginMutation / rejectCrossOrigin", () => {
  beforeEach(() => {
    headerStore.clear();
  });

  it.each([
    { site: "cross-site", origin: "https://app.example", host: "app.example", ok: false },
    { site: "same-origin", origin: "https://evil.example", host: "app.example", ok: true },
    { site: "same-site", origin: "https://evil.example", host: "app.example", ok: true },
    { site: "none", origin: "https://evil.example", host: "app.example", ok: true },
  ] as const)(
    "Sec-Fetch-Site=$site → allowed=$ok (Origin ignored when site is set)",
    async ({ site, origin, host, ok }) => {
      setHeaders({
        "sec-fetch-site": site,
        origin,
        host,
      });
      if (ok) {
        await expect(assertSameOriginMutation()).resolves.toBeUndefined();
        await expect(rejectCrossOrigin()).resolves.toBeNull();
      } else {
        await expect(assertSameOriginMutation()).rejects.toBeInstanceOf(
          CrossOriginRequestError,
        );
        const res = await rejectCrossOrigin();
        expect(res).not.toBeNull();
        expect(res!.status).toBe(403);
        const body = await res!.json();
        expect(body).toEqual({
          error: "Cross-origin mutating request blocked.",
        });
      }
    },
  );

  it("absent Sec-Fetch-Site + matching Origin/Host allows", async () => {
    setHeaders({
      origin: "https://app.example",
      host: "app.example",
    });
    await expect(assertSameOriginMutation()).resolves.toBeUndefined();
    await expect(rejectCrossOrigin()).resolves.toBeNull();
  });

  it("absent Sec-Fetch-Site + matching Origin / X-Forwarded-Host allows", async () => {
    // X-Forwarded-Host is preferred over Host (proxy case).
    setHeaders({
      origin: "https://app.example",
      "x-forwarded-host": "app.example",
      host: "internal:3000",
    });
    await expect(assertSameOriginMutation()).resolves.toBeUndefined();
  });

  it("CHARACTERISATION: default HTTPS port in Origin host vs X-Forwarded-Host :443 mismatches", async () => {
    // new URL("https://app.example:443").host → "app.example" (port stripped).
    setHeaders({
      origin: "https://app.example:443",
      "x-forwarded-host": "app.example:443",
      host: "internal:3000",
    });
    await expect(assertSameOriginMutation()).rejects.toBeInstanceOf(
      CrossOriginRequestError,
    );
  });

  it("absent Sec-Fetch-Site + mismatching Origin rejects", async () => {
    setHeaders({
      origin: "https://evil.example",
      host: "app.example",
    });
    await expect(assertSameOriginMutation()).rejects.toBeInstanceOf(
      CrossOriginRequestError,
    );
  });

  it("absent Sec-Fetch-Site + malformed Origin rejects", async () => {
    setHeaders({
      origin: "not-a-url",
      host: "app.example",
    });
    await expect(assertSameOriginMutation()).rejects.toBeInstanceOf(
      CrossOriginRequestError,
    );
  });

  it("absent Sec-Fetch-Site + absent Origin rejects", async () => {
    setHeaders({ host: "app.example" });
    await expect(assertSameOriginMutation()).rejects.toBeInstanceOf(
      CrossOriginRequestError,
    );
  });

  it("absent Sec-Fetch-Site + absent Host rejects", async () => {
    setHeaders({ origin: "https://app.example" });
    await expect(assertSameOriginMutation()).rejects.toBeInstanceOf(
      CrossOriginRequestError,
    );
  });

  it("Origin/Host comparison is case-insensitive", async () => {
    setHeaders({
      origin: "https://App.Example",
      host: "app.example",
    });
    await expect(assertSameOriginMutation()).resolves.toBeUndefined();
  });
});

describe("getRequestIp (TRUSTED_PROXY_HOPS)", () => {
  const original = process.env.TRUSTED_PROXY_HOPS;

  beforeEach(() => {
    headerStore.clear();
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TRUSTED_PROXY_HOPS;
    } else {
      process.env.TRUSTED_PROXY_HOPS = original;
    }
  });

  describe("default (0 hops): X-Forwarded-For ignored", () => {
    it("ignores X-Forwarded-For and uses X-Real-IP", async () => {
      setHeaders({
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "x-real-ip": " 10.1.2.3 ",
      });
      expect(await getRequestIp()).toBe("10.1.2.3");
    });

    it("returns unknown when only X-Forwarded-For is present", async () => {
      setHeaders({ "x-forwarded-for": "1.2.3.4" });
      expect(await getRequestIp()).toBe("unknown");
    });

    it("returns unknown when no IP headers", async () => {
      setHeaders({});
      expect(await getRequestIp()).toBe("unknown");
    });

    it.each(["", "abc", "-1", "1.5", "0"])(
      "TRUSTED_PROXY_HOPS=%j behaves as 0",
      async (value) => {
        process.env.TRUSTED_PROXY_HOPS = value;
        setHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
        expect(await getRequestIp()).toBe("unknown");
      },
    );
  });

  describe("TRUSTED_PROXY_HOPS=1 (single trusted proxy, e.g. Caddy)", () => {
    beforeEach(() => {
      process.env.TRUSTED_PROXY_HOPS = "1";
    });

    it("uses the rightmost X-Forwarded-For entry", async () => {
      setHeaders({ "x-forwarded-for": "9.9.9.9" });
      expect(await getRequestIp()).toBe("9.9.9.9");
    });

    it("spoofing: leftmost client-supplied value is NOT the key", async () => {
      // Client sent "203.0.113.99"; the trusted proxy appended the real peer.
      setHeaders({ "x-forwarded-for": "203.0.113.99, 198.51.100.7" });
      expect(await getRequestIp()).toBe("198.51.100.7");
    });

    it("spoofing: many forged leading entries do not change the key", async () => {
      setHeaders({
        "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3, 198.51.100.7",
      });
      expect(await getRequestIp()).toBe("198.51.100.7");
    });

    it("trims spaces around the selected hop", async () => {
      setHeaders({ "x-forwarded-for": "1.1.1.1 ,   198.51.100.7  " });
      expect(await getRequestIp()).toBe("198.51.100.7");
    });

    it("falls back to X-Real-IP when the selected hop is empty", async () => {
      setHeaders({
        "x-forwarded-for": "1.1.1.1, ",
        "x-real-ip": "10.0.0.1",
      });
      expect(await getRequestIp()).toBe("10.0.0.1");
    });

    it("falls back to X-Real-IP when X-Forwarded-For absent", async () => {
      setHeaders({ "x-real-ip": "10.0.0.2" });
      expect(await getRequestIp()).toBe("10.0.0.2");
    });

    it("returns unknown when no IP headers", async () => {
      setHeaders({});
      expect(await getRequestIp()).toBe("unknown");
    });
  });

  describe("TRUSTED_PROXY_HOPS=2", () => {
    beforeEach(() => {
      process.env.TRUSTED_PROXY_HOPS = "2";
    });

    it("takes the second entry from the right", async () => {
      setHeaders({ "x-forwarded-for": "6.6.6.6, 198.51.100.7, 10.0.0.1" });
      expect(await getRequestIp()).toBe("198.51.100.7");
    });

    it("falls back to X-Real-IP when fewer entries than hops", async () => {
      setHeaders({
        "x-forwarded-for": "198.51.100.7",
        "x-real-ip": "10.0.0.3",
      });
      expect(await getRequestIp()).toBe("10.0.0.3");
    });

    it("falls back to unknown when fewer entries than hops and no X-Real-IP", async () => {
      setHeaders({ "x-forwarded-for": "198.51.100.7" });
      expect(await getRequestIp()).toBe("unknown");
    });
  });
});

describe("warnTrustedProxyHopsIfNeeded", () => {
  beforeEach(() => {
    resetTrustedProxyHopsWarningForTests();
  });

  afterEach(() => {
    resetTrustedProxyHopsWarningForTests();
    vi.restoreAllMocks();
  });

  it("warns once in production when hops are 0", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnTrustedProxyHopsIfNeeded({
      NODE_ENV: "production",
      TRUSTED_PROXY_HOPS: "0",
    } as NodeJS.ProcessEnv);
    warnTrustedProxyHopsIfNeeded({
      NODE_ENV: "production",
      TRUSTED_PROXY_HOPS: "0",
    } as NodeJS.ProcessEnv);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0] ?? "");
    expect(line).toContain("TRUSTED_PROXY_HOPS_ZERO");
  });

  it("does not warn when hops are 1 or NODE_ENV is not production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnTrustedProxyHopsIfNeeded({
      NODE_ENV: "production",
      TRUSTED_PROXY_HOPS: "1",
    } as NodeJS.ProcessEnv);
    warnTrustedProxyHopsIfNeeded({
      NODE_ENV: "development",
      TRUSTED_PROXY_HOPS: "0",
    } as NodeJS.ProcessEnv);
    expect(warn).not.toHaveBeenCalled();
  });
});
