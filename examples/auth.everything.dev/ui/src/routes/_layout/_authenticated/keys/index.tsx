import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, Input, UnderConstruction } from "@/components";
import { useApiClient } from "@/lib/use-api-client";

type ApiClient = import("@/app").ApiClient;

export const Route = createFileRoute("/_layout/_authenticated/keys/")({
  head: () => ({
    meta: [
      { title: "KV Store | app" },
      { name: "description", content: "Key-value store for testing." },
    ],
  }),
  component: KeysList,
});

function KeysList() {
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  type KeysListResult = Awaited<ReturnType<ApiClient["projects"]["listKeys"]>>;
  type SetValueResult = Awaited<ReturnType<ApiClient["projects"]["setValue"]>>;

  const keysQuery = useQuery<KeysListResult>({
    queryKey: ["kv-keys"],
    queryFn: () => apiClient.projects.listKeys({ limit: 50 }),
  });

  const createMutation = useMutation<SetValueResult, Error, { key: string; value: string }>({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiClient.projects.setValue({ key, value }),
    onSuccess: async (data) => {
      toast.success(`Key "${data.key}" ${data.created ? "created" : "updated"}`);
      await queryClient.invalidateQueries({ queryKey: ["kv-keys"] });
      setNewKey("");
      setNewValue("");
      setShowCreateForm(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create key");
    },
  });

  const generateSampleKeys = useMutation<number, Error>({
    mutationFn: async () => {
      const sampleKeys = Array.from({ length: 25 }, (_, i) => ({
        key: `sample-key-${String(i + 1).padStart(3, "0")}`,
        value: `Sample value for key ${i + 1} - ${new Date().toISOString()}`,
      }));

      await Promise.all(
        sampleKeys.map(({ key, value }) => apiClient.projects.setValue({ key, value })),
      );
      return sampleKeys.length;
    },
    onSuccess: async (count) => {
      toast.success(`Created ${count} sample keys`);
      await queryClient.invalidateQueries({ queryKey: ["kv-keys"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate sample keys");
    },
  });

  const keys = keysQuery.data?.keys || [];
  const total = keysQuery.data?.total || 0;
  const hasMore = keysQuery.data?.hasMore || false;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">developer tools</Badge>
              <Badge variant="outline">kv</Badge>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">KV Test Store</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create sample keys, inspect stored values, and walk through the authenticated API
                tooling without leaving the workspace.
              </p>
              <UnderConstruction
                label="keys"
                sourceFile="ui/src/routes/_layout/_authenticated/keys/index.tsx"
                className="w-full max-w-sm mt-3"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setShowCreateForm((value) => !value)}
                variant="outline"
                size="sm"
              >
                {showCreateForm ? "close form" : "new key"}
              </Button>
              <Button
                onClick={() => generateSampleKeys.mutate()}
                disabled={generateSampleKeys.isPending || keys.length >= 10}
                variant="outline"
                size="sm"
              >
                {generateSampleKeys.isPending ? "creating..." : "generate samples"}
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/home">back to workspace</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatBox label="total keys" value={String(total)} />
            <StatBox label="showing" value={String(keys.length)} />
            <StatBox label="more" value={hasMore ? "yes" : "no"} />
          </CardContent>
        </Card>
      </section>

      {showCreateForm && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="font-medium">Create key</div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="key name"
              />
              <Input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
              />
            </div>
            <Button
              onClick={() => createMutation.mutate({ key: newKey, value: newValue })}
              disabled={createMutation.isPending || !newKey || !newValue}
              variant="outline"
              size="sm"
            >
              {createMutation.isPending ? "creating..." : "create key"}
            </Button>
          </CardContent>
        </Card>
      )}

      {keysQuery.isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading keys...
          </CardContent>
        </Card>
      ) : keysQuery.isError ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm">The KV list could not be loaded.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => keysQuery.refetch()}>
              retry
            </Button>
          </CardContent>
        </Card>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <p className="text-sm">No keys yet.</p>
            <p className="text-sm text-muted-foreground">
              Create your first key or generate sample data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {keys.map((item: (typeof keys)[number], index: number) => (
            <Card key={item.key}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-muted-foreground font-mono">#{index + 1}</div>
                    <Link
                      to="/keys/$key"
                      params={{ key: item.key }}
                      className="font-medium break-all hover:underline"
                    >
                      {item.key}
                    </Link>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="rounded-sm border border-border bg-muted/10 p-3 text-xs font-mono text-muted-foreground break-all">
                  updated {new Date(item.updatedAt).toLocaleString()}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/keys/$key" params={{ key: item.key }}>
                    open key
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted/10 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
