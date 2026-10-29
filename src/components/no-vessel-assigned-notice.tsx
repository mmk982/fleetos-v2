import Link from "next/link";

/**
 * Fail-closed UX for vessel-scoped roles with no `vesselId`.
 * Controllers still throw ForbiddenError; pages catch and render this.
 */
export function NoVesselAssignedNotice() {
  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">No vessel assigned</p>
        <p className="mt-1">
          No vessel is assigned to your account — contact an administrator.{" "}
          <Link href="/dashboard" className="underline underline-offset-2">
            Back to Dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
