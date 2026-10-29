import Link from "next/link";

/**
 * Friendly notice when the caller lacks module access (HTTP 200, not 500).
 * Controllers still throw ForbiddenError; pages catch and render this.
 */
export function AccessDeniedNotice({
  title = "You don't have access to this page",
  description = "Your role is not allowed to open this section.",
}: {
  title?: string;
  description?: string;
} = {}) {
  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">{title}</p>
        <p className="mt-1">
          {description}{" "}
          <Link href="/dashboard" className="underline underline-offset-2">
            Back to Dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
