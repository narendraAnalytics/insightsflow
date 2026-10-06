"use client";

const Z = "font-(family-name:--font-zeyada)";

export default function SettingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-[26px] border border-(--flow-coral)/40 bg-(--flow-cream) p-6">
      <p className={`${Z} text-[30px] leading-none font-normal text-(--flow-coral)`}>This section didn&apos;t load</p>
      <p className={`mt-1 ${Z} text-[21px] leading-snug font-normal text-(--flow-ink)/70`}>
        Something went wrong on our side. Your settings weren&apos;t changed.
      </p>
      <button
        type="button"
        onClick={reset}
        className={`bg-gradient-flow mt-4 rounded-full px-6 py-2.5 ${Z} text-[22px] leading-none font-normal text-(--flow-cream)`}
      >
        Try again
      </button>
    </div>
  );
}
