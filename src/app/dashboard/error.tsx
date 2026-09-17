"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard-segment Error Boundary. Next.js strips error details when
 * crossing into a client boundary, so this can only ever show generic copy.
 * Page-specific "you don't have access" messaging must happen server-side
 * (catch ForbiddenError before it reaches here) — see e.g. vessels/page.tsx.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-start gap-4 p-8" dir="auto">
      <div className="max-w-lg rounded-none border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Something went wrong
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          An unexpected error occurred in the dashboard. You can try again or
          return to the home screen.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-none border border-zinc-300 px-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
