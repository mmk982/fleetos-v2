import type { Metadata } from "next";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopBar } from "@/components/dashboard-top-bar";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "FleetOS — Dashboard",
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  return (
    <div className="flex min-h-full flex-1 bg-zinc-50 dark:bg-black">
      <DashboardSidebar role={session.user.role} />
      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <DashboardTopBar />
        {children}
      </div>
    </div>
  );
}
