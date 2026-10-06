import { SettingsNav } from "@/components/dashboard/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
      <div>
        <h1 className="text-gradient-flow font-(family-name:--font-zeyada) text-[44px] leading-none font-normal">
          Settings
        </h1>
        <p className="mt-2 font-(family-name:--font-zeyada) text-[26px] leading-snug font-normal text-(--flow-magenta)">
          Your account, credits, connected apps and data in one place.
        </p>
      </div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
