/**
 * Nested-dialog registry: top-most dialog owns Escape + focus trap;
 * `[data-app-shell]` is marked `inert` while any dialog is open.
 */

export type DialogStackEntry = {
  id: string;
  root: HTMLElement;
  onEscape: () => void;
};

const stack: DialogStackEntry[] = [];

function applyShellInert(inert: boolean): void {
  if (typeof document === "undefined") return;
  const shells = document.querySelectorAll<HTMLElement>("[data-app-shell]");
  for (const shell of shells) {
    if (inert) {
      shell.setAttribute("inert", "");
      shell.setAttribute("aria-hidden", "true");
    } else {
      shell.removeAttribute("inert");
      shell.removeAttribute("aria-hidden");
    }
  }
}

function syncInert(): void {
  applyShellInert(stack.length > 0);
}

/** Register an open dialog; returns an unregister function. */
export function pushDialog(entry: DialogStackEntry): () => void {
  stack.push(entry);
  syncInert();
  return () => {
    const idx = stack.findIndex((e) => e.id === entry.id);
    if (idx >= 0) stack.splice(idx, 1);
    syncInert();
  };
}

export function getTopDialog(): DialogStackEntry | undefined {
  return stack[stack.length - 1];
}

export function isTopDialog(id: string): boolean {
  return getTopDialog()?.id === id;
}

/** Test-only: clear stack between cases. */
export function __resetDialogStackForTests(): void {
  stack.length = 0;
  syncInert();
}

export function __dialogStackDepthForTests(): number {
  return stack.length;
}
