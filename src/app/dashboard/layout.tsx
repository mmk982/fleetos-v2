import type { Metadata } from "next";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export const metadata: Metadata = {
  title: "FleetOS — Dashboard",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 bg-zinc-50 dark:bg-black">
      <DashboardSidebar />
      <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
