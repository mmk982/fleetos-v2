import type { Metadata } from "next";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopBar } from "@/components/dashboard-top-bar";
import { SidebarChromeProvider } from "@/components/sidebar-chrome";
import { requireSession } from "@/lib/auth/session";
import { getNavBadges } from "@/lib/nav-badges";

export const metadata: Metadata = {
  title: "FleetOS — Dashboard",
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();
  const badges = await getNavBadges(session);

  return (
    <SidebarChromeProvider>
      <div className="flex min-h-full flex-1 bg-[var(--bg-page)]">
        <DashboardSidebar role={session.user.role} badges={badges} />
        <div className="flex min-h-full min-w-0 flex-1 flex-col">
          <DashboardTopBar />
          {children}
        </div>
      </div>
    </SidebarChromeProvider>
  );
}
