/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import {
  cycleFocus,
  getFocusableElements,
  handleFocusTrapKeydown,
} from "@/lib/a11y/focusable";

function el(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const node = {
    tagName: tag.toUpperCase(),
    getAttribute: (name: string) => attrs[name] ?? null,
    hasAttribute: (name: string) => name in attrs,
    hidden: attrs.hidden === "true",
    focus: vi.fn(),
  };
  return node as unknown as HTMLElement;
}

describe("cycleFocus", () => {
  it("returns null for an empty list", () => {
    expect(cycleFocus([], null, "forward")).toBeNull();
  });

  it("returns the only item for a single-element list", () => {
    const a = el("button");
    expect(cycleFocus([a], null, "forward")).toBe(a);
    expect(cycleFocus([a], a, "backward")).toBe(a);
  });

  it("cycles forward and wraps", () => {
    const a = el("button");
    const b = el("button");
    const c = el("button");
    const items = [a, b, c];
    expect(cycleFocus(items, a, "forward")).toBe(b);
    expect(cycleFocus(items, c, "forward")).toBe(a);
    expect(cycleFocus(items, null, "forward")).toBe(a);
  });

  it("cycles backward and wraps", () => {
    const a = el("button");
    const b = el("button");
    const c = el("button");
    const items = [a, b, c];
    expect(cycleFocus(items, a, "backward")).toBe(c);
    expect(cycleFocus(items, b, "backward")).toBe(a);
  });
});

describe("getFocusableElements + handleFocusTrapKeydown (happy-dom/jsdom-free)", () => {
  it("re-queries focusables on each Tab so added nodes are included", () => {
    // Minimal ParentNode stub: first call returns 1 button, second returns 2.
    let round = 0;
    const a = el("button");
    const b = el("button");
    a.focus = vi.fn();
    b.focus = vi.fn();

    const root = {
      querySelectorAll: () => {
        round += 1;
        return round === 1 ? [a] : [a, b];
      },
      contains: (node: Node | null) => node === a || node === b,
    } as unknown as ParentNode;

    // Patch document.activeElement via a property — handleFocusTrap uses it.
    const activeDesc = Object.getOwnPropertyDescriptor(document, "activeElement");
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      get: () => a,
    });

    try {
      // First Tab with one focusable: preventDefault + refocus a
      const e1 = {
        key: "Tab",
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;
      expect(handleFocusTrapKeydown(e1, root)).toBe(true);
      expect(e1.preventDefault).toHaveBeenCalled();
      expect(a.focus).toHaveBeenCalled();

      // Second Tab after a second control appears: at end → wrap to first
      Object.defineProperty(document, "activeElement", {
        configurable: true,
        get: () => b,
      });
      const e2 = {
        key: "Tab",
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;
      // Force re-query: root returns [a,b] now
      expect(handleFocusTrapKeydown(e2, root)).toBe(true);
      expect(e2.preventDefault).toHaveBeenCalled();
      expect(a.focus).toHaveBeenCalledTimes(2);
    } finally {
      if (activeDesc) {
        Object.defineProperty(document, "activeElement", activeDesc);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (document as any).activeElement;
      }
    }
  });

  it("Shift+Tab from first wraps to last", () => {
    const a = el("button");
    const b = el("button");
    b.focus = vi.fn();
    const root = {
      querySelectorAll: () => [a, b],
      contains: (node: Node | null) => node === a || node === b,
    } as unknown as ParentNode;

    const activeDesc = Object.getOwnPropertyDescriptor(document, "activeElement");
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      get: () => a,
    });
    try {
      const e = {
        key: "Tab",
        shiftKey: true,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;
      expect(handleFocusTrapKeydown(e, root)).toBe(true);
      expect(b.focus).toHaveBeenCalled();
    } finally {
      if (activeDesc) {
        Object.defineProperty(document, "activeElement", activeDesc);
      }
    }
  });

  it("ignores non-Tab keys", () => {
    const root = {
      querySelectorAll: () => [],
      contains: () => false,
    } as unknown as ParentNode;
    const e = {
      key: "Escape",
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    expect(handleFocusTrapKeydown(e, root)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});

describe("getFocusableElements with real DOM (when document is available)", () => {
  it("skips disabled and nested-dialog controls", () => {
    if (typeof document === "undefined" || !document.createElement) {
      return;
    }
    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    root.innerHTML = `
      <button id="ok">Ok</button>
      <button id="dis" disabled>No</button>
      <input id="txt" />
      <div role="dialog"><button id="nested">Nested</button></div>
    `;
    document.body.appendChild(root);
    try {
      const items = getFocusableElements(root);
      const ids = items.map((n) => n.id);
      expect(ids).toContain("ok");
      expect(ids).toContain("txt");
      expect(ids).not.toContain("dis");
      expect(ids).not.toContain("nested");
    } finally {
      root.remove();
    }
  });
});
