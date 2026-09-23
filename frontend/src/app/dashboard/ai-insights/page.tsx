import { InsightsChat } from "@/components/dashboard/insights/insights-chat";

export default function AiInsightsPage() {
  return (
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
      <div>
        <h1 className="font-heading text-[22px] font-semibold text-(--flow-ink)">AI Insights</h1>
        <p className="mt-1 text-[13.5px] text-(--flow-ink)/55">
          Ask questions about your connected Google Sheet in plain language.
        </p>
      </div>
      <InsightsChat />
    </div>
  );
}
