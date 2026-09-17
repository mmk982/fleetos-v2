"use client";

import { useTheme } from "next-themes";

/** Sun/moon toggle — client island for the server-rendered top bar. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)]"
    >
      <MoonIcon className="h-4 w-4 dark:hidden" aria-hidden="true" />
      <SunIcon className="hidden h-4 w-4 dark:block" aria-hidden="true" />
    </button>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
    </svg>
  );
}
