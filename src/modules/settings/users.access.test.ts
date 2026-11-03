/**
 * Users controller — settings_users access (real access helpers).
 * Password/session/last-admin behaviour lives in users.controller.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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

vi.mock("@/lib/auth/pwned-password", () => ({
  isPasswordBreached: vi.fn(async () => false),
  assertPasswordAllowed: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth/session", () => ({
  destroySessionsForUser: vi.fn(async () => undefined),
  destroySession: vi.fn(async () => undefined),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
  withDb: async (_ctx: unknown, fn: (db: unknown) => unknown) => fn(getDb()),
}));

import { ForbiddenError } from "@/lib/auth/access";
import { MODULE_PERMISSIONS } from "@/lib/auth/permissions";
import {
  createUser,
  listUsers,
  setUserActive,
  updateUser,
} from "./users.controller";

const USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const OTHER = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const UNAUTH = { userId: "", role: "admin" as const, vesselId: null };
const ADMIN = { userId: USER, role: "admin" as const, vesselId: null };
const VALID_PASSWORD = "valid-long-password";

describe("users MODULE_PERMISSIONS oracle", () => {
  it("settings_users is admin-only write; all others none", () => {
    expect(MODULE_PERMISSIONS.admin.settings_users).toBe("write");
    expect(MODULE_PERMISSIONS.superintendent.settings_users).toBe("none");
    expect(MODULE_PERMISSIONS.management_user.settings_users).toBe("none");
    expect(MODULE_PERMISSIONS.vessel_user.settings_users).toBe("none");
    expect(MODULE_PERMISSIONS.read_only.settings_users).toBe("none");
  });
});

describe("users.controller access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listUsers denies unauthenticated", async () => {
    await expect(listUsers(UNAUTH)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each([
    "superintendent",
    "management_user",
    "vessel_user",
    "read_only",
  ] as const)("listUsers ForbiddenError for %s (settings_users:none)", async (role) => {
    await expect(
      listUsers({
        userId: USER,
        role,
        vesselId: role === "vessel_user" || role === "management_user" ? OTHER : null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each([
    "superintendent",
    "management_user",
    "vessel_user",
    "read_only",
  ] as const)("createUser ForbiddenError for %s", async (role) => {
    await expect(
      createUser(
        {
          userId: USER,
          role,
          vesselId:
            role === "vessel_user" || role === "management_user" ? OTHER : null,
        },
        {
          name: "New",
          email: "new@example.com",
          password: VALID_PASSWORD,
          role: "read_only",
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["superintendent", "read_only"] as const)(
    "updateUser ForbiddenError for %s",
    async (role) => {
      await expect(
        updateUser(
          { userId: USER, role, vesselId: null },
          OTHER,
          { name: "Renamed" },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["superintendent", "read_only"] as const)(
    "setUserActive ForbiddenError for %s",
    async (role) => {
      await expect(
        setUserActive({ userId: USER, role, vesselId: null }, OTHER, false),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("listUsers happy path for admin", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            orderBy: async () => [
              {
                id: USER,
                name: "Admin",
                email: "admin@example.com",
                role: "admin",
                isActive: true,
                vesselId: null,
                vesselName: null,
                lastLoginAt: null,
                createdAt: new Date(),
              },
            ],
          }),
        }),
      }),
    });

    const rows = await listUsers(ADMIN);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(USER);
  });

  it("createUser happy path for admin", async () => {
    getDb.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => [
            {
              id: OTHER,
              name: "New",
              email: "new@example.com",
              passwordHash: "hashed:x",
              role: "read_only",
              vesselId: null,
              isActive: true,
              lastLoginAt: null,
              preferredLocale: null,
              preferredTheme: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }),
      }),
    });

    const row = await createUser(ADMIN, {
      name: "New",
      email: "new@example.com",
      password: VALID_PASSWORD,
      role: "read_only",
    });
    expect(row.id).toBe(OTHER);
    expect(hashPassword).toHaveBeenCalledWith(VALID_PASSWORD);
  });
});
