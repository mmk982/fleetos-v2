/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cycleFocus,
  getFocusableElements,
  handleFocusTrapKeydown,
} from "@/lib/a11y/focusable";

/** Plain stubs for pure cycleFocus (no DOM APIs). */
function stubEl(tag: string): HTMLElement {
  return {
    tagName: tag.toUpperCase(),
    focus: vi.fn(),
  } as unknown as HTMLElement;
}

describe("cycleFocus", () => {
  it("returns null for an empty list", () => {
    expect(cycleFocus([], null, "forward")).toBeNull();
  });

  it("returns the only item for a single-element list", () => {
    const a = stubEl("button");
    expect(cycleFocus([a], null, "forward")).toBe(a);
    expect(cycleFocus([a], a, "backward")).toBe(a);
  });

  it("cycles forward and wraps", () => {
    const a = stubEl("button");
    const b = stubEl("button");
    const c = stubEl("button");
    const items = [a, b, c];
    expect(cycleFocus(items, a, "forward")).toBe(b);
    expect(cycleFocus(items, c, "forward")).toBe(a);
    expect(cycleFocus(items, null, "forward")).toBe(a);
  });

  it("cycles backward and wraps", () => {
    const a = stubEl("button");
    const b = stubEl("button");
    const c = stubEl("button");
    const items = [a, b, c];
    expect(cycleFocus(items, a, "backward")).toBe(c);
    expect(cycleFocus(items, b, "backward")).toBe(a);
  });
});

describe("handleFocusTrapKeydown (happy-dom Elements)", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("re-queries focusables on each Tab so added nodes are included", () => {
    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    const a = document.createElement("button");
    a.id = "a";
    a.textContent = "A";
    root.appendChild(a);
    document.body.appendChild(root);

    const focusA = vi.spyOn(a, "focus");

    a.focus();
    const e1 = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    const prevented1 = !root.dispatchEvent(e1);
    // handleFocusTrapKeydown is called directly (not via listener)
    expect(handleFocusTrapKeydown(e1, root)).toBe(true);
    expect(e1.defaultPrevented || prevented1).toBe(true);
    expect(focusA).toHaveBeenCalled();

    const b = document.createElement("button");
    b.id = "b";
    b.textContent = "B";
    root.appendChild(b);
    b.focus();

    const e2 = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    expect(handleFocusTrapKeydown(e2, root)).toBe(true);
    expect(e2.defaultPrevented).toBe(true);
    // Wrapped to first
    expect(document.activeElement).toBe(a);
  });

  it("Shift+Tab from first wraps to last", () => {
    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    const a = document.createElement("button");
    a.id = "a";
    a.textContent = "A";
    const b = document.createElement("button");
    b.id = "b";
    b.textContent = "B";
    root.append(a, b);
    document.body.appendChild(root);

    a.focus();
    const e = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    expect(handleFocusTrapKeydown(e, root)).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(b);
  });

  it("ignores non-Tab keys", () => {
    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    document.body.appendChild(root);
    const e = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    expect(handleFocusTrapKeydown(e, root)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });
});

describe("getFocusableElements with real DOM", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("skips disabled and nested-dialog controls", () => {
    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    root.innerHTML = `
      <button id="ok">Ok</button>
      <button id="dis" disabled>No</button>
      <input id="txt" />
      <div role="dialog"><button id="nested">Nested</button></div>
    `;
    document.body.appendChild(root);
    const items = getFocusableElements(root);
    const ids = items.map((n) => n.id);
    expect(ids).toContain("ok");
    expect(ids).toContain("txt");
    expect(ids).not.toContain("dis");
    expect(ids).not.toContain("nested");
  });
});
