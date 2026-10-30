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
      <a
        href="#main-content"
        className="absolute start-4 top-4 z-[100] -translate-y-[200%] rounded-md bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-md outline outline-2 outline-[var(--accent)] focus:translate-y-0"
      >
        Skip to main content
      </a>
      <div className="flex min-h-full flex-1 bg-[var(--bg-page)]">
        <DashboardSidebar role={session.user.role} badges={badges} />
        <div className="flex min-h-full min-w-0 flex-1 flex-col">
          <DashboardTopBar />
          <div id="main-content">{children}</div>
        </div>
      </div>
    </SidebarChromeProvider>
  );
}
