/**
 * Modal — bottom sheet on mobile, centered dialog on desktop.
 *
 * Same Escape / body-scroll-lock / focus-trap pattern as {@link Drawer}.
 * Callers whose content has no visible heading should pass `ariaLabel`
 * (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 5).
 */
"use client";

import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogA11y } from "@/lib/a11y/use-dialog-a11y";
import { useIsClient } from "@/lib/a11y/use-is-client";

export function Modal({
  open,
  onClose,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible name when children do not start with a labelled heading. */
  ariaLabel?: string;
}) {
  const isClient = useIsClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogA11y({
    open,
    ready: isClient,
    onClose,
    containerRef,
    initialFocusRef: panelRef,
  });

  if (!open || !isClient) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full rounded-t-2xl bg-[var(--bg-card)] p-4 outline-none md:w-[380px] md:rounded-xl md:p-5"
      >
        <div
          className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--border)] md:hidden"
          aria-hidden="true"
        />
        {children}
      </div>
    </div>,
    document.body,
  );
}
