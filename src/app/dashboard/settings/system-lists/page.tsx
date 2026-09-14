import { SettingsSubnav } from "@/components/settings-subnav";
import {
  SystemListsHub,
  type SystemListKey,
  type SystemListRow,
} from "@/components/system-lists-hub";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import {
  listCertificateTypes,
  listIssuingAuthorities,
} from "@/modules/certificates/certificate.controller";
import {
  listCrewCategories,
  listEndorsementTypes,
} from "@/modules/crew/crew.controller";
import { listDrawingCategories } from "@/modules/drawings/drawing.controller";
import { listIsmTemplateCategories } from "@/modules/ism-templates/ismTemplate.controller";
import { listDeficiencySeverityLevels } from "@/modules/deficiencies/deficiency.controller";

export const dynamic = "force-dynamic";

export default async function SystemListsPage() {
  const session = await requireSession();
  const access = toAccessContext(session);

  const [
    certificateTypes,
    issuingAuthorities,
    ismCategories,
    drawingCategories,
    crewCategories,
    endorsementTypes,
    severityLevels,
  ] = await Promise.all([
    listCertificateTypes(access),
    listIssuingAuthorities(access),
    listIsmTemplateCategories(access),
    listDrawingCategories(access),
    listCrewCategories(access),
    listEndorsementTypes(access),
    listDeficiencySeverityLevels(access),
  ]);

  const lists: Record<SystemListKey, SystemListRow[]> = {
    certificate_types: certificateTypes.map((r) => ({
      id: r.id,
      name: r.name,
      isCustom: r.isCustom,
      authority: r.authority,
      ruleKind: r.ruleKind,
      offsetDays: r.offsetDays,
    })),
    issuing_authorities: issuingAuthorities.map((r) => ({
      id: r.id,
      name: r.name,
      isCustom: r.isCustom,
    })),
    ism_template_categories: ismCategories.map((r) => ({
      id: r.id,
      name: r.name,
      isCustom: r.isCustom,
    })),
    drawing_categories: drawingCategories.map((r) => ({
      id: r.id,
      name: r.name,
      isCustom: r.isCustom,
    })),
    crew_categories: crewCategories.map((r) => ({
      id: r.id,
      name: r.name,
      isCustom: r.isCustom,
    })),
    endorsement_types: endorsementTypes.map((r) => ({
      id: r.id,
      name: r.name,
      isCustom: r.isCustom,
    })),
    deficiency_severity_levels: severityLevels.map((r) => ({
      id: r.id,
      name: r.name,
      isCustom: r.isCustom,
    })),
  };

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage seeded and user-extensible reference lists.
        </p>
      </div>

      <SettingsSubnav />
      <SystemListsHub lists={lists} />
    </main>
  );
}
