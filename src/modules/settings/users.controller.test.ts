/**
 * Users controller — password policy, session revoke, last-admin, email case.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
  assertModuleAccess: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/activity-log/write", () => ({
  writeActivityLog: vi.fn(async () => undefined),
}));

const hashPassword = vi.fn(async (plain: string) => `hashed:${plain}`);
vi.mock("@/lib/auth/password", () => ({
  hashPassword: (plain: string) => hashPassword(plain),
}));

const isPasswordBreached = vi.fn<(plain: string) => Promise<boolean>>();
vi.mock("@/lib/auth/pwned-password", () => ({
  isPasswordBreached: (plain: string) => isPasswordBreached(plain),
  // Re-implement assertPasswordAllowed against the mock so HIBP can be stubbed.
  assertPasswordAllowed: async (plain: string) => {
    if (plain.length < 12) {
      throw new Error(
        "Password must be at least 12 characters (SECURITY_PLAN.md §2.2).",
      );
    }
    if (await isPasswordBreached(plain)) {
      throw new Error(
        "That password appears in a known data breach. Choose a different password.",
      );
    }
  },
}));

const destroySessionsForUser = vi.fn<(userId: string) => Promise<void>>();
const destroySession = vi.fn<(sessionId?: string) => Promise<void>>();
vi.mock("@/lib/auth/session", () => ({
  destroySessionsForUser: (userId: string) => destroySessionsForUser(userId),
  destroySession: (sessionId?: string) => destroySession(sessionId),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
  withDb: async (_ctx: unknown, fn: (db: unknown) => unknown) => fn(getDb()),
}));

import { loginSchema } from "@/modules/auth/validation";
import {
  changeUserPassword,
  createUser,
  PasswordRejectedError,
  setUserActive,
  updateUser,
  UserConflictError,
} from "./users.controller";

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CTX = { userId: ADMIN_ID, role: "admin" as const, vesselId: null };

const VALID_PASSWORD = "valid-long-password";

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ADMIN_ID,
    name: "Admin",
    email: "admin@example.com",
    passwordHash: "hashed:old",
    role: "admin" as const,
    vesselId: null,
    isActive: true,
    lastLoginAt: null,
    preferredLocale: null,
    preferredTheme: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** `select().from().where()` — awaitable for counts; `.limit()` for row loads. */
function selectChain(opts: {
  limitRows?: unknown[];
  countN?: number;
}) {
  const whereResult = {
    limit: async () => opts.limitRows ?? [],
    then: (
      onfulfilled?: (v: unknown) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) =>
      Promise.resolve([{ n: opts.countN ?? 0 }]).then(onfulfilled, onrejected),
  };
  return {
    from: () => ({
      where: () => whereResult,
    }),
  };
}

describe("users.controller password policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPasswordBreached.mockResolvedValue(false);
    destroySessionsForUser.mockResolvedValue(undefined);
    destroySession.mockResolvedValue(undefined);
    hashPassword.mockImplementation(async (plain: string) => `hashed:${plain}`);
  });

  it("rejects short passwords before hashing", async () => {
    await expect(
      createUser(CTX, {
        name: "New",
        email: "new@example.com",
        password: "short",
        role: "read_only",
      }),
    ).rejects.toBeInstanceOf(PasswordRejectedError);

    expect(isPasswordBreached).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects breached passwords (mocked HIBP) before hashing", async () => {
    isPasswordBreached.mockResolvedValue(true);

    await expect(
      createUser(CTX, {
        name: "New",
        email: "new@example.com",
        password: VALID_PASSWORD,
        role: "read_only",
      }),
    ).rejects.toMatchObject({
      name: "PasswordRejectedError",
      message: expect.stringMatching(/breach/i),
    });

    expect(isPasswordBreached).toHaveBeenCalledOnce();
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it("accepts a valid password and stores a lowercased email", async () => {
    let inserted: Record<string, unknown> | undefined;
    getDb.mockReturnValue({
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          inserted = vals;
          return {
            returning: async () => [
              userRow({
                id: OTHER_ID,
                name: vals.name,
                email: vals.email,
                passwordHash: vals.passwordHash,
                role: vals.role,
                vesselId: vals.vesselId ?? null,
              }),
            ],
          };
        },
      }),
    });

    const row = await createUser(CTX, {
      name: "New User",
      email: "  New.User@Example.COM ",
      password: VALID_PASSWORD,
      role: "read_only",
    });

    expect(isPasswordBreached).toHaveBeenCalledWith(VALID_PASSWORD);
    expect(hashPassword).toHaveBeenCalledWith(VALID_PASSWORD);
    expect(inserted?.email).toBe("new.user@example.com");
    expect(row.email).toBe("new.user@example.com");
  });
});

describe("users.controller session revoke on password change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPasswordBreached.mockResolvedValue(false);
    destroySessionsForUser.mockResolvedValue(undefined);
    destroySession.mockResolvedValue(undefined);
  });

  it("revokes all sessions after a password change", async () => {
    getDb.mockReturnValue({
      select: () =>
        selectChain({
          limitRows: [{ id: OTHER_ID, name: "Other" }],
        }),
      update: () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    });

    await changeUserPassword(CTX, OTHER_ID, VALID_PASSWORD);

    expect(destroySessionsForUser).toHaveBeenCalledWith(OTHER_ID);
    expect(destroySession).not.toHaveBeenCalled();
  });

  it("also clears the cookie when the admin changes their own password", async () => {
    getDb.mockReturnValue({
      select: () =>
        selectChain({
          limitRows: [{ id: ADMIN_ID, name: "Admin" }],
        }),
      update: () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    });

    await changeUserPassword(CTX, ADMIN_ID, VALID_PASSWORD);

    expect(destroySessionsForUser).toHaveBeenCalledWith(ADMIN_ID);
    expect(destroySession).toHaveBeenCalledOnce();
  });
});

describe("users.controller last active admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks demoting the last active admin", async () => {
    getDb.mockReturnValue({
      select: () =>
        selectChain({
          limitRows: [userRow()],
          countN: 0,
        }),
    });

    await expect(
      updateUser(CTX, ADMIN_ID, { role: "read_only" }),
    ).rejects.toMatchObject({
      name: "UserConflictError",
      message: expect.stringMatching(/last active admin/i),
    });
  });

  it("blocks deactivating the last active admin", async () => {
    getDb.mockReturnValue({
      select: () =>
        selectChain({
          limitRows: [userRow({ id: OTHER_ID })],
          countN: 0,
        }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [userRow({ id: OTHER_ID, isActive: false })],
          }),
        }),
      }),
    });

    await expect(
      setUserActive(
        { ...CTX, userId: ADMIN_ID },
        OTHER_ID,
        false,
      ),
    ).rejects.toBeInstanceOf(UserConflictError);
  });

  it("allows demoting an admin when another active admin remains", async () => {
    const demoted = userRow({ id: OTHER_ID, role: "read_only" });
    getDb.mockReturnValue({
      select: () =>
        selectChain({
          limitRows: [userRow({ id: OTHER_ID })],
          countN: 1,
        }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [demoted],
          }),
        }),
      }),
    });

    const row = await updateUser(CTX, OTHER_ID, { role: "read_only" });
    expect(row.role).toBe("read_only");
  });
});

describe("case-insensitive login email (A-22)", () => {
  it("lowercases trimmed emails in loginSchema", () => {
    const parsed = loginSchema.safeParse({
      email: "  Admin@Example.COM ",
      password: "anything",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("admin@example.com");
    }
  });
});
