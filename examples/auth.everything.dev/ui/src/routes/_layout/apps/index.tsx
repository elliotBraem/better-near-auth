import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Input, UnderConstruction } from "@/components";
import { useApiClient } from "@/lib/use-api-client";

type SearchParams = {
  q?: string;
};

export const Route = createFileRoute("/_layout/apps/")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" && search.q.length > 0 ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ context, deps }) => {
    await Promise.allSettled([
      context.queryClient.ensureQueryData({
        queryKey: ["registry-apps", deps.q],
        queryFn: () =>
          context.apiClient.registry.listRegistryApps({ q: deps.q || undefined, limit: 48 }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ["registry-status"],
        queryFn: () => context.apiClient.registry.getRegistryStatus(),
        staleTime: 60_000,
      }),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Published Apps | app" },
      {
        name: "description",
        content: "Browse bos-startable apps discovered from published bos.config.json records.",
      },
    ],
  }),
  component: AppsIndex,
});

function AppsIndex() {
  const search = Route.useSearch();
  const apiClient = useApiClient();
  const [query, setQuery] = useState(search.q ?? "");

  const appsQuery = useQuery({
    queryKey: ["registry-apps", search.q],
    queryFn: () => apiClient.registry.listRegistryApps({ q: search.q || undefined, limit: 48 }),
  });

  const registryStatusQuery = useQuery({
    queryKey: ["registry-status"],
    queryFn: () => apiClient.registry.getRegistryStatus(),
    staleTime: 60_000,
  });

  const apps = appsQuery.data?.data ?? [];
  const stats = useMemo(() => {
    const ready = apps.filter((app) => app.status === "ready").length;
    const claimed = apps.filter((app) => app.metadata?.claimedBy).length;

    return {
      total: appsQuery.data?.meta.total ?? 0,
      ready,
      claimed,
    };
  }, [apps, appsQuery.data?.meta.total]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Badge variant="outline">registry</Badge>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Published Apps</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Browse runtimes that resolve from canonical `bos.config.json` records, inspect the
                effective host/ui/api shape, and jump into account or gateway detail views.
              </p>
              <UnderConstruction
                label="published apps"
                sourceFile="ui/src/routes/_layout/apps/index.tsx"
                className="w-full max-w-sm mt-3"
              />
            </div>

            <form className="flex flex-col gap-3 sm:flex-row" action="/apps" method="get">
              <Input
                name="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="search by account or gateway"
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button type="submit" variant="outline" size="sm">
                  search
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!search.q && query.length === 0}
                  onClick={() => {
                    setQuery("");
                    window.history.pushState({}, "", "/apps");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }}
                >
                  clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatBox label="apps" value={String(stats.total)} />
            <StatBox label="ready" value={String(stats.ready)} />
            <StatBox label="claimed" value={String(stats.claimed)} />
            {registryStatusQuery.data && (
              <div className="text-xs text-muted-foreground font-mono pt-2 border-t border-border">
                relay {registryStatusQuery.data.relayEnabled ? "enabled" : "disabled"}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {appsQuery.isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Discovering published runtimes...
          </CardContent>
        </Card>
      ) : appsQuery.isError ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm">The registry could not be loaded right now.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => appsQuery.refetch()}>
              retry
            </Button>
          </CardContent>
        </Card>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <p className="text-sm">No published apps found.</p>
            <p className="text-xs text-muted-foreground">
              Try a different account or gateway search, or clear the filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {apps.map((app) => (
            <Card key={`${app.accountId}/${app.gatewayId}`} className="h-full">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={app.status === "ready" ? "default" : "destructive"}>
                        {app.status}
                      </Badge>
                      {app.metadata?.claimedBy && <Badge variant="outline">claimed</Badge>}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Link
                        to="/apps/$accountId/$gatewayId"
                        params={{ accountId: app.accountId, gatewayId: app.gatewayId }}
                        className="block font-medium hover:underline break-all"
                      >
                        {app.metadata?.title ?? `${app.accountId} / ${app.gatewayId}`}
                      </Link>
                      <div className="text-xs font-mono text-muted-foreground break-all">
                        {app.accountId} / {app.gatewayId}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground min-h-10 leading-relaxed">
                  {app.metadata?.description ?? "No public registry metadata published yet."}
                </p>

                <div className="rounded-sm border border-border bg-muted/10 p-3 text-xs font-mono text-muted-foreground break-all">
                  {app.hostUrl ?? app.uiUrl ?? app.apiUrl ?? app.canonicalKey}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link
                      to="/apps/$accountId/$gatewayId"
                      params={{ accountId: app.accountId, gatewayId: app.gatewayId }}
                    >
                      inspect runtime
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/apps/$accountId" params={{ accountId: app.accountId }}>
                      account view
                    </Link>
                  </Button>
                  {app.openUrl && (
                    <Button asChild variant="outline" size="sm">
                      <a href={app.openUrl} target="_blank" rel="noreferrer">
                        open app
                      </a>
                    </Button>
                  )}
                </div>
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
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
