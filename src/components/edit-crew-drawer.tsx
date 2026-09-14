"use client";

import { useRouter } from "next/navigation";
import { CrewForm } from "@/components/crew-form";
import { Drawer } from "@/components/ui/drawer";
import type {
  CrewCategoryRow,
  CrewMemberRow,
  VesselRow,
} from "@/db/schema";

export function EditCrewDrawer({
  member,
  vessels,
  categories,
}: {
  member: CrewMemberRow;
  vessels: VesselRow[];
  categories: CrewCategoryRow[];
}) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push(`/dashboard/crew/${member.id}`)}
      title="Edit crew member"
    >
      <CrewForm
        mode="edit"
        crewMemberId={member.id}
        defaultValues={member}
        vessels={vessels}
        categories={categories}
        onCancelHref={`/dashboard/crew/${member.id}`}
      />
    </Drawer>
  );
}
