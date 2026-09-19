import Link from "next/link";
import { VesselForm } from "@/components/vessel-form";

export default function NewVesselPage() {
  return (
    <main className="flex flex-1 flex-col p-8">
      <div className="mb-8">
        <Link
          href="/dashboard/vessels"
          className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
        >
          ← Back to vessels
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          New vessel
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Enter identification and tonnage. IMO must be unique when provided.
        </p>
      </div>
      <VesselForm mode="create" />
    </main>
  );
}
