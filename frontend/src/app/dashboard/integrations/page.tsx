import { Suspense } from "react";
import { GmailCard } from "@/components/dashboard/integrations/gmail-card";
import { GoogleSheetsCard } from "@/components/dashboard/integrations/google-sheets-card";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
      <div>
        <h1 className="text-gradient-flow font-(family-name:--font-zeyada) text-[44px] leading-none font-normal">Connect your apps</h1>
        <p className="mt-2 font-(family-name:--font-zeyada) text-[26px] leading-snug font-normal text-(--flow-magenta)">
          Connect a data source so InsightFlow can read and analyze it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <GoogleSheetsCard />
        <Suspense fallback={null}>
          <GmailCard />
        </Suspense>
      </div>
    </div>
  );
}
