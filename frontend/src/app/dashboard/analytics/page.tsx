import { AnalyticsView } from "@/components/dashboard/analytics/analytics-view";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
      <div>
        <h1 className="text-gradient-flow font-(family-name:--font-zeyada) text-[44px] leading-none font-normal">
          Analytics
        </h1>
        <p className="mt-2 font-(family-name:--font-zeyada) text-[26px] leading-snug font-normal text-(--flow-magenta)">
          How you use InsightFlow: questions, credits and automations over time.
        </p>
      </div>
      <AnalyticsView />
    </div>
  );
}
