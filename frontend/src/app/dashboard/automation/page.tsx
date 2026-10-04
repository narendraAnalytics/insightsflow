import { AutomationView } from "@/components/dashboard/automation/automation-view";

export default function AutomationPage() {
  return (
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
      <div>
        <h1 className="text-gradient-flow font-(family-name:--font-zeyada) text-[44px] leading-none font-normal">
          Automation
        </h1>
        <p className="mt-2 font-(family-name:--font-zeyada) text-[26px] leading-snug font-normal text-(--flow-magenta)">
          Scheduled reports that wait for your approval before anything is sent.
        </p>
      </div>
      <AutomationView />
    </div>
  );
}
