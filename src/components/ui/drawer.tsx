/**
 * Side drawer (desktop) / full-screen sheet (mobile).
 *
 * Breakpoint switch is CSS-only via `md:` so resize does not flash
 * (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 5). Uses logical `end-0` so
 * the panel mirrors correctly in RTL. Escape closes; body scroll locks while
 * open. Full Tab focus-trap deferred until Task 9.
 */
"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
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
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 hidden bg-black/50 md:block"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-y-0 end-0 flex h-full w-full flex-col bg-[var(--bg-card)] md:w-[380px] md:max-w-[90vw]">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 md:h-auto md:border-0 md:pt-5">
          <Button
            ref={closeRef}
            variant="ghost"
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="md:hidden"
          >
            ←
          </Button>
          <h2
            id={titleId}
            className="text-base font-medium text-[var(--text-primary)]"
          >
            {title}
          </h2>
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ms-auto hidden md:inline"
          >
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
