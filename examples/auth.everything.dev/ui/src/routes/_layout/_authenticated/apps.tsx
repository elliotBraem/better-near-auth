import { createFileRoute } from "@tanstack/react-router";
import { UnderConstruction } from "@/components/under-construction";

export const Route = createFileRoute("/_layout/_authenticated/apps")({
  head: () => ({
    meta: [{ title: "Apps | app" }, { name: "description", content: "Discover and manage apps." }],
  }),
  component: AppsPage,
});

function AppsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
      <UnderConstruction
        label="apps"
        sourceFile="ui/src/routes/_layout/_authenticated/apps.tsx"
        className="w-full max-w-sm"
      />
    </div>
  );
}
