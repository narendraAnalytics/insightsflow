import { GoogleSheetsCard } from "@/components/dashboard/integrations/google-sheets-card";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
      <div>
        <h1 className="font-heading text-[22px] font-semibold text-(--flow-ink)">Connect your apps</h1>
        <p className="mt-1 text-[13.5px] text-(--flow-ink)/55">
          Connect a data source so InsightFlow can read and analyze it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <GoogleSheetsCard />
      </div>
    </div>
  );
}
