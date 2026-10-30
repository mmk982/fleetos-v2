/**
 * Focusable-element helpers for dialog focus traps (Drawer / Modal).
 * Pure DOM utilities — safe to unit-test without React.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isVisible(el: HTMLElement): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.hidden) return false;
  // jsdom has no layout; skip getComputedStyle when window is stubby.
  if (typeof window !== "undefined" && window.getComputedStyle) {
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
  }
  return true;
}

/**
 * Returns focusable descendants of `root` in document order.
 * When `root` is a dialog, skips elements that live inside a nested dialog.
 */
export function getFocusableElements(root: ParentNode): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const out: HTMLElement[] = [];
  const rootEl = root instanceof Element ? root : null;
  for (const el of nodes) {
    if (!isVisible(el)) continue;
    if (rootEl) {
      const nearestDialog = el.closest('[role="dialog"]');
      if (nearestDialog && nearestDialog !== rootEl) continue;
    }
    out.push(el);
  }
  return out;
}

/**
 * Given the current focus target and direction, returns the next element
 * to focus within `items` (wrapping). Returns `null` when `items` is empty.
 */
export function cycleFocus(
  items: readonly HTMLElement[],
  current: Element | null,
  direction: "forward" | "backward",
): HTMLElement | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0] ?? null;

  const index = current ? items.indexOf(current as HTMLElement) : -1;
  if (direction === "forward") {
    if (index < 0 || index >= items.length - 1) return items[0] ?? null;
    return items[index + 1] ?? null;
  }
  if (index <= 0) return items[items.length - 1] ?? null;
  return items[index - 1] ?? null;
}

/**
 * Handles Tab / Shift+Tab inside a dialog. Returns true when the event was
 * consumed (caller should preventDefault).
 */
export function handleFocusTrapKeydown(
  event: KeyboardEvent,
  root: ParentNode,
): boolean {
  if (event.key !== "Tab") return false;
  const items = getFocusableElements(root);
  if (items.length === 0) {
    event.preventDefault();
    return true;
  }
  if (items.length === 1) {
    event.preventDefault();
    items[0]?.focus();
    return true;
  }
  const active = document.activeElement;
  const atStart = active === items[0];
  const atEnd = active === items[items.length - 1];
  const outside = !(root instanceof Node && active && root.contains(active));
  if (event.shiftKey && (atStart || outside)) {
    event.preventDefault();
    items[items.length - 1]?.focus();
    return true;
  }
  if (!event.shiftKey && (atEnd || outside)) {
    event.preventDefault();
    items[0]?.focus();
    return true;
  }
  return false;
}
