import { createFileRoute } from "@tanstack/react-router";
import { UserApiKeysPanel } from "@/components/settings-sections";

export const Route = createFileRoute("/_layout/_authenticated/api-keys")({
  head: () => ({
    title: "API Keys | auth.everything.dev",
    meta: [
      { name: "description", content: "Manage personal API keys." },
    ],
  }),
  component: ApiKeysPage,
});

function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Create personal API keys and manage their lifecycle.
        </p>
      </div>

      <UserApiKeysPanel />
    </div>
  );
}
