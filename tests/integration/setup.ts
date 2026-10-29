/**
 * Vitest setup for RLS integration tests.
 * Mocks `server-only` so Next server modules can load under node.
 */
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
