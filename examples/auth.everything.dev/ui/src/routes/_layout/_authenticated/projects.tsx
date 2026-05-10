import { createFileRoute } from "@tanstack/react-router";
import { UnderConstruction } from "@/components/under-construction";

export const Route = createFileRoute("/_layout/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects | app" },
      { name: "description", content: "Manage your projects." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <UnderConstruction
        label="projects"
        sourceFile="ui/src/routes/_layout/_authenticated/projects.tsx"
        className="w-full max-w-sm"
      />
    </div>
  );
}
