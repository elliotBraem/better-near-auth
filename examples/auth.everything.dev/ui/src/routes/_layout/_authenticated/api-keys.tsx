import { createFileRoute } from "@tanstack/react-router";
import { UserApiKeysPanel } from "@/components/settings-sections";

export const Route = createFileRoute("/_layout/_authenticated/api-keys")({
  head: () => ({
    title: "API Keys | auth.everything.dev",
    meta: [{ name: "description", content: "Manage personal API keys." }],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["user-api-keys"],
      queryFn: async () => {
        const { data, error } = await context.authClient.apiKey.list({
          query: { configId: "user-keys" },
        });
        if (error) throw new Error(error.message);
        return (data?.apiKeys ?? []) as any[];
      },
      staleTime: 30_000,
    });
  },
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
