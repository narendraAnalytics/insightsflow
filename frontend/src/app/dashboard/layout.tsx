import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { TooltipLayer } from "@/components/dashboard/tooltip-layer";
import { CreditsProvider } from "@/components/billing/credits-provider";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <CreditsProvider>
      <div className="dashboard-root flex h-dvh bg-(--flow-cream)">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardTopbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <TooltipLayer />
    </CreditsProvider>
  );
}
