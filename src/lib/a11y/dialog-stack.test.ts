/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __dialogStackDepthForTests,
  __resetDialogStackForTests,
  getTopDialog,
  isTopDialog,
  pushDialog,
} from "@/lib/a11y/dialog-stack";

describe("dialog-stack", () => {
  afterEach(() => {
    __resetDialogStackForTests();
    document.querySelectorAll("[data-app-shell]").forEach((n) => n.remove());
  });

  it("tracks top-most dialog and nests correctly", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    const unA = pushDialog({ id: "a", root: a, onEscape: vi.fn() });
    expect(isTopDialog("a")).toBe(true);
    expect(__dialogStackDepthForTests()).toBe(1);

    const unB = pushDialog({ id: "b", root: b, onEscape: vi.fn() });
    expect(isTopDialog("b")).toBe(true);
    expect(isTopDialog("a")).toBe(false);
    expect(getTopDialog()?.id).toBe("b");

    unB();
    expect(isTopDialog("a")).toBe(true);
    unA();
    expect(__dialogStackDepthForTests()).toBe(0);
  });

  it("sets and clears inert + aria-hidden on [data-app-shell]", () => {
    const shell = document.createElement("div");
    shell.setAttribute("data-app-shell", "");
    document.body.appendChild(shell);

    const root = document.createElement("div");
    const un = pushDialog({ id: "x", root, onEscape: vi.fn() });
    expect(shell.hasAttribute("inert")).toBe(true);
    expect(shell.getAttribute("aria-hidden")).toBe("true");

    un();
    expect(shell.hasAttribute("inert")).toBe(false);
    expect(shell.getAttribute("aria-hidden")).toBeNull();
  });
});
