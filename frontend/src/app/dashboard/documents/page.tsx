import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { DocumentsCard } from "@/components/dashboard/integrations/documents-card";

export default function DocumentsPage() {
  return (
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
      <div>
        <h1 className="text-gradient-flow font-(family-name:--font-zeyada) text-[44px] leading-none font-normal">
          Documents
        </h1>
        <p className="mt-2 font-(family-name:--font-zeyada) text-[26px] leading-snug font-normal text-(--flow-magenta)">
          Upload an invoice, statement or receipt and turn it into data you can ask about.
        </p>
      </div>

      <div className="max-w-3xl">
        <DocumentsCard />
      </div>

      <Link
        href="/dashboard/ai-insights"
        className="bg-gradient-flow inline-flex w-fit items-center gap-2 rounded-full px-6 py-2.5 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97]"
      >
        <ChatCircleText weight="bold" className="size-4" />
        Ask AI about your documents
      </Link>
    </div>
  );
}
