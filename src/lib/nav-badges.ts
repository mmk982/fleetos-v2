import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import type { SessionContext } from "@/lib/auth/session";
import { getAlerts } from "@/modules/alerts/alerts.controller";
import { getOpenDeficienciesCount } from "@/modules/deficiencies/deficiency.controller";
import { listMonthlyForms } from "@/modules/monthly-forms/monthlyForm.controller";

export type NavBadgeTone = "danger" | "warning";

export type NavBadges = {
  /** Certificates: expired if >0 else due-soon; tone danger/warning. */
  certificates: { count: number; tone: NavBadgeTone } | null;
  /** Open deficiencies — danger when >0. */
  deficiencies: { count: number; tone: NavBadgeTone } | null;
  /** Pending monthly forms — warning when >0. */
  monthlyForms: { count: number; tone: NavBadgeTone } | null;
  /**
   * Crew expiring-soon — stubbed at null (no query in this codebase yet).
   * Gap flagged for a later pass.
   */
  crew: { count: number; tone: NavBadgeTone } | null;
};

/** Empty badges — used when a vessel-scoped caller has no vessel assigned. */
export const EMPTY_NAV_BADGES: NavBadges = {
  certificates: null,
  deficiencies: null,
  monthlyForms: null,
  crew: null,
};

/** Aggregate sidebar badge counts from existing alert/deficiency/form queries. */
export async function getNavBadges(session: SessionContext): Promise<NavBadges> {
  const access = toAccessContext(session);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  try {
    // Sequential: each helper may open withDb on the pool; avoid stacking
    // concurrent work that can nest into the same transaction client.
    const certificateAlerts = await getAlerts(access, {
      kinds: ["certificate"],
      statuses: ["valid", "expiring", "critical", "expired"],
    });
    const openDeficiencies = await getOpenDeficienciesCount(access);
    const pendingForms = await listMonthlyForms(access, {
      month,
      year,
      status: "pending",
    });

    let expired = 0;
    let dueSoon = 0;
    for (const item of certificateAlerts) {
      if (item.status === "expired") expired += 1;
      else if (item.status === "expiring" || item.status === "critical") {
        dueSoon += 1;
      }
    }

    const certCount = expired > 0 ? expired : dueSoon;
    const certTone: NavBadgeTone = expired > 0 ? "danger" : "warning";

    return {
      certificates:
        certCount > 0 ? { count: certCount, tone: certTone } : null,
      deficiencies:
        openDeficiencies > 0
          ? { count: openDeficiencies, tone: "danger" }
          : null,
      monthlyForms:
        pendingForms.length > 0
          ? { count: pendingForms.length, tone: "warning" }
          : null,
      crew: null, // stub — no crew-expiring query yet
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return EMPTY_NAV_BADGES;
    }
    throw error;
  }
}
