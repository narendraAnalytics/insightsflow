import { Suspense } from "react";
import { InsightsChat } from "@/components/dashboard/insights/insights-chat";

export default function AiInsightsPage() {
  return (
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
      <div>
        <h1 className="text-gradient-flow font-(family-name:--font-zeyada) text-[44px] leading-none font-normal">AI Insights</h1>
        <p className="mt-2 font-(family-name:--font-zeyada) text-[26px] leading-snug font-normal text-(--flow-magenta)">
          Ask questions about your connected Google Sheet in plain language.
        </p>
      </div>
      <Suspense fallback={null}>
        <InsightsChat />
      </Suspense>
    </div>
  );
}
