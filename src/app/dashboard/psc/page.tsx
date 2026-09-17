import Link from "next/link";

export const dynamic = "force-dynamic";

/** PSC stub — sidebar placeholder until PROJECT_PLAN.md §7b ships. */
export default function PscPage() {
  return (
    <main className="flex flex-1 flex-col p-5 sm:p-5" dir="auto">
      <h1 className="text-[18px] font-medium text-[var(--text-primary)]">
        PSC
      </h1>
      <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
        Coming soon.
      </p>
      <p className="mt-4 text-[13px] text-[var(--text-tertiary)]">
        Port State Control inspections will live here.{" "}
        <Link
          href="/dashboard"
          className="text-[var(--accent)] hover:underline"
        >
          Back to Dashboard
        </Link>
      </p>
    </main>
  );
}
