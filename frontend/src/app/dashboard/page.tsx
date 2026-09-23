import { WelcomeHeroCard } from "@/components/dashboard/welcome-hero-card";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { ProjectActivityChart } from "@/components/dashboard/project-activity-chart";
import { TaskOverviewDonut } from "@/components/dashboard/task-overview-donut";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { ProjectsTable } from "@/components/dashboard/projects-table";
import { UpgradeCard, MotivationCard } from "@/components/dashboard/promo-cards";

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5">
        <WelcomeHeroCard />
        <KpiCards />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
          <ProjectActivityChart />
          <TaskOverviewDonut />
        </div>
        <ProjectsTable />
      </div>

      <div className="flex flex-col gap-5">
        <QuickActions />
        <RecentActivity />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <UpgradeCard />
          <MotivationCard />
        </div>
      </div>
    </div>
  );
}
