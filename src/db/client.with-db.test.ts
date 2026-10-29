/**
 * Unit tests for {@link withDb} / {@link withSystemDb} / production role guard.
 * Uses a mocked `pg.Pool` — no real database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type QueryResult = { rows: Array<Record<string, unknown>> };
type QueryFn = (
  text: string,
  params?: unknown[],
) => Promise<QueryResult>;

const query = vi.fn<QueryFn>(async () => ({ rows: [] }));
const release = vi.fn();
const connect = vi.fn(async () => ({ query, release }));

vi.mock("pg", () => ({
  Pool: vi.fn(function MockPool(this: unknown) {
    return { connect, end: vi.fn() };
  }),
}));

describe("withDb / withSystemDb", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    query.mockClear();
    release.mockClear();
    connect.mockClear();
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://fleetos_app:fleetos_app@localhost:5433/fleetos",
    );
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("BEGIN → set_config user/role/vessel → fn → COMMIT → release", async () => {
    const { withDb, closeDb } = await import("./client");
    const order: string[] = [];
    query.mockImplementation(async (text, params) => {
      if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") {
        order.push(text);
      } else if (typeof text === "string" && text.includes("set_config")) {
        order.push(`set_config:${String(params?.[0])}=${String(params?.[1])}`);
      }
      return { rows: [] };
    });

    await withDb(
      { userId: "u1", role: "vessel_user", vesselId: "v1" },
      async () => {
        order.push("fn");
        return 42;
      },
    );

    expect(order).toEqual([
      "BEGIN",
      "set_config:app.user_id=u1",
      "set_config:app.role=vessel_user",
      "set_config:app.vessel_id=v1",
      "fn",
      "COMMIT",
    ]);
    expect(release).toHaveBeenCalledTimes(1);
    await closeDb();
  });

  it("ROLLBACK on fn error and still releases", async () => {
    const { withDb, closeDb } = await import("./client");
    const order: string[] = [];
    query.mockImplementation(async (text) => {
      if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") {
        order.push(text);
      }
      return { rows: [] };
    });

    await expect(
      withDb({ userId: "u1", role: "admin", vesselId: null }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(order).toContain("BEGIN");
    expect(order).toContain("ROLLBACK");
    expect(order).not.toContain("COMMIT");
    expect(release).toHaveBeenCalledTimes(1);
    await closeDb();
  });

  it("withSystemDb sets app.role=system", async () => {
    const { withSystemDb, closeDb } = await import("./client");
    const roles: string[] = [];
    query.mockImplementation(async (text, params) => {
      if (typeof text === "string" && text.includes("set_config")) {
        roles.push(`${String(params?.[0])}=${String(params?.[1])}`);
      }
      return { rows: [] };
    });

    await withSystemDb("email-digest", async () => "ok");
    expect(roles).toEqual([
      "app.user_id=",
      "app.role=system",
      "app.vessel_id=",
    ]);
    await closeDb();
  });

  it("nested withDb takes exactly one pool client", async () => {
    const { withDb, closeDb } = await import("./client");
    query.mockImplementation(async () => ({ rows: [] }));

    await withDb(
      { userId: "u1", role: "admin", vesselId: null },
      async () => {
        await withDb(
          { userId: "u1", role: "admin", vesselId: null },
          async () => "inner",
        );
        return "outer";
      },
    );

    expect(connect).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    await closeDb();
  });

  it("nested withDb with different ctx re-sets locals without new connect", async () => {
    const { withDb, closeDb } = await import("./client");
    const setConfigs: string[] = [];
    query.mockImplementation(async (text, params) => {
      if (typeof text === "string" && text.includes("set_config")) {
        setConfigs.push(`${String(params?.[0])}=${String(params?.[1])}`);
      }
      return { rows: [] };
    });

    await withDb(
      { userId: "u1", role: "admin", vesselId: null },
      async () => {
        await withDb(
          { userId: "u2", role: "vessel_user", vesselId: "v2" },
          async () => "inner",
        );
      },
    );

    expect(connect).toHaveBeenCalledTimes(1);
    expect(setConfigs).toEqual([
      "app.user_id=u1",
      "app.role=admin",
      "app.vessel_id=",
      "app.user_id=u2",
      "app.role=vessel_user",
      "app.vessel_id=v2",
    ]);
    await closeDb();
  });
});

describe("assertProductionRuntimeRole", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no-ops when NODE_ENV is not production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { assertProductionRuntimeRole } = await import("./client");
    const queryFn = vi.fn();
    await assertProductionRuntimeRole(queryFn);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("throws when current_user is superuser", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { assertProductionRuntimeRole } = await import("./client");
    await expect(
      assertProductionRuntimeRole(async () => ({
        rows: [{ rolsuper: true, rolbypassrls: false }],
      })),
    ).rejects.toThrow("runtime must use fleetos_app");
  });

  it("throws when current_user has BYPASSRLS", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { assertProductionRuntimeRole } = await import("./client");
    await expect(
      assertProductionRuntimeRole(async () => ({
        rows: [{ rolsuper: false, rolbypassrls: true }],
      })),
    ).rejects.toThrow("runtime must use fleetos_app");
  });

  it("passes for a normal app role", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { assertProductionRuntimeRole } = await import("./client");
    await expect(
      assertProductionRuntimeRole(async () => ({
        rows: [{ rolsuper: false, rolbypassrls: false }],
      })),
    ).resolves.toBeUndefined();
  });

  it("getPool/withDb in production queries pg_roles once via connect", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://fleetos_app:fleetos_app@localhost:5433/fleetos",
    );
    query.mockClear();
    connect.mockClear();
    release.mockClear();

    query.mockImplementation(async (text) => {
      if (typeof text === "string" && text.includes("pg_roles")) {
        return { rows: [{ rolsuper: false, rolbypassrls: false }] };
      }
      return { rows: [] };
    });

    const { withDb, closeDb } = await import("./client");
    await withDb(
      { userId: "u1", role: "admin", vesselId: null },
      async () => "ok",
    );

    const roleQueries = query.mock.calls.filter(
      (c) => typeof c[0] === "string" && String(c[0]).includes("pg_roles"),
    );
    expect(roleQueries.length).toBe(1);
    // role check connect + transaction connect
    expect(connect).toHaveBeenCalledTimes(2);
    await closeDb();
  });
});
