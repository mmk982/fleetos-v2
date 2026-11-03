/**
 * A-24: email-digest cron handler primes business timezone before running.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const isValidCronAuth = vi.fn();
vi.mock("@/lib/auth/cron-auth", () => ({
  isValidCronAuth: (...args: unknown[]) => isValidCronAuth(...args),
}));

const primeBusinessTimezone = vi.fn(async () => undefined);
vi.mock("@/lib/settings/business-time", () => ({
  primeBusinessTimezone: () => primeBusinessTimezone(),
}));

const runEmailDigest = vi.fn(async () => ({ sent: 0, skipped: 0 }));
vi.mock("@/modules/email-digest/email-digest.controller", () => ({
  runEmailDigest: () => runEmailDigest(),
}));

import { POST } from "./route";

const SECRET = "a".repeat(32);

describe("POST /api/internal/email-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    isValidCronAuth.mockReturnValue(true);
    runEmailDigest.mockResolvedValue({ sent: 1, skipped: 0 });
  });

  it("primes business timezone before runEmailDigest", async () => {
    const callOrder: string[] = [];
    primeBusinessTimezone.mockImplementation(async () => {
      callOrder.push("prime");
    });
    runEmailDigest.mockImplementation(async () => {
      callOrder.push("run");
      return { sent: 1, skipped: 0 };
    });

    const res = await POST(
      new Request("http://localhost/api/internal/email-digest", {
        method: "POST",
        headers: { Authorization: `Bearer ${SECRET}` },
      }),
    );

    expect(res.status).toBe(200);
    expect(primeBusinessTimezone).toHaveBeenCalledTimes(1);
    expect(runEmailDigest).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["prime", "run"]);
  });

  it("does not prime timezone when cron auth fails", async () => {
    isValidCronAuth.mockReturnValue(false);
    const res = await POST(
      new Request("http://localhost/api/internal/email-digest", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(401);
    expect(primeBusinessTimezone).not.toHaveBeenCalled();
    expect(runEmailDigest).not.toHaveBeenCalled();
  });
});
