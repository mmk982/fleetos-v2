/**
 * Shared open-dialog behaviour for Drawer and Modal: body scroll lock,
 * focus trap, Escape (top-most only), return focus, shell inert.
 */
"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { handleFocusTrapKeydown } from "@/lib/a11y/focusable";
import { isTopDialog, pushDialog } from "@/lib/a11y/dialog-stack";

export function useDialogA11y({
  open,
  ready,
  onClose,
  containerRef,
  initialFocusRef,
}: {
  open: boolean;
  /** False until the dialog portal is allowed to mount (client-only). */
  ready: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  /** Prefer this element for initial focus when present. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}): void {
  const reactId = useId();
  const dialogId = `dialog-${reactId}`;
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || !ready) return;

    const root = containerRef.current;
    if (!root) return;

    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const unregister = pushDialog({
      id: dialogId,
      root,
      onEscape: onClose,
    });

    const preferred = initialFocusRef?.current;
    if (preferred && root.contains(preferred)) {
      preferred.focus();
    } else {
      const first = root.querySelector<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      if (first) first.focus();
      else root.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!isTopDialog(dialogId)) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      const container = containerRef.current;
      if (!container) return;
      handleFocusTrapKeydown(e, container);
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      unregister();
      document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      if (opener && document.contains(opener)) {
        opener.focus();
      }
      openerRef.current = null;
    };
  }, [open, ready, onClose, containerRef, initialFocusRef, dialogId]);
}
