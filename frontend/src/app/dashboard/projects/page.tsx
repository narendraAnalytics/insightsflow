import { ProjectsGrid } from "@/components/dashboard/projects/projects-grid";

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
      <div>
        <h1 className="text-gradient-flow font-(family-name:--font-zeyada) text-[44px] leading-none font-normal">
          Projects
        </h1>
        <p className="mt-2 font-(family-name:--font-zeyada) text-[26px] leading-snug font-normal text-(--flow-magenta)">
          Every connected spreadsheet, grouped into one place to explore.
        </p>
      </div>
      <ProjectsGrid />
    </div>
  );
}
