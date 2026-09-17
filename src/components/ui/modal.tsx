/**
 * Modal — bottom sheet on mobile, centered dialog on desktop.
 *
 * Same Escape / body-scroll-lock pattern as {@link Drawer}. Callers whose
 * content has no visible heading should pass `ariaLabel`
 * (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 5). Focus trap deferred to Task 9.
 */
"use client";

import { useEffect, useRef, type ReactNode } from "react";

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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
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
        className="relative w-full rounded-none bg-[var(--bg-card)] p-4 outline-none md:w-[380px] md:rounded-none md:p-5"
      >
        <div
          className="mx-auto mb-3 h-1 w-9 rounded-none bg-[var(--border)] md:hidden"
          aria-hidden="true"
        />
        {children}
      </div>
    </div>
  );
}
