import Link from "next/link";
import { VesselForm } from "@/components/vessel-form";

export default function NewVesselPage() {
  return (
    <main className="flex flex-1 flex-col p-8">
      <div className="mb-8">
        <Link
          href="/dashboard/vessels"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Back to vessels
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          New vessel
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Enter identification and tonnage. IMO must be unique when provided.
        </p>
      </div>
      <VesselForm mode="create" />
    </main>
  );
}
