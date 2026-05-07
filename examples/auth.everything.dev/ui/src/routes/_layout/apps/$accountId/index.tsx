import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge, Button, Card, CardContent } from "@/components";
import { useApiClient } from "@/lib/use-api-client";

export const Route = createFileRoute("/_layout/apps/$accountId/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.accountId} | Published Apps | app` },
      {
        name: "description",
        content: `Published BOS runtimes for ${params.accountId}.`,
      },
    ],
  }),
  component: AccountAppsPage,
});

function AccountAppsPage() {
  const { accountId } = Route.useParams();
  const apiClient = useApiClient();
  type RegistryAppsResult = Awaited<ReturnType<typeof apiClient.registry.getRegistryAppsByAccount>>;

  const accountQuery = useQuery<RegistryAppsResult>({
    queryKey: ["registry-account", accountId],
    queryFn: () => apiClient.registry.getRegistryAppsByAccount({ accountId }),
  });

  const apps = accountQuery.data?.data ?? [];
  const readyCount = apps.filter((app: (typeof apps)[number]) => app.status === "ready").length;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          <Link to="/apps" search={{}} className="hover:text-foreground transition-colors">
            apps
          </Link>
          <span>/</span>
          <span>{accountId}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardContent className="p-6 space-y-3">
              <Badge variant="outline">account</Badge>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight break-all">
                {accountId}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Gateway runtimes discovered for this account. Use the account view to compare
                runtime records before jumping into a specific gateway detail page.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <MiniStat label="gateways" value={String(apps.length)} />
              <MiniStat label="ready" value={String(readyCount)} />
            </CardContent>
          </Card>
        </div>
      </section>

      {accountQuery.isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading account runtimes...
          </CardContent>
        </Card>
      ) : accountQuery.isError ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm">This account view could not be loaded.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => accountQuery.refetch()}
            >
              retry
            </Button>
          </CardContent>
        </Card>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm">No published gateways were found for this account.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/apps" search={{}}>
                back to registry
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {apps.map((app: RegistryAppsResult["data"][number]) => (
            <Card key={app.gatewayId}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={app.status === "ready" ? "default" : "destructive"}>
                        {app.status}
                      </Badge>
                      {app.metadata?.claimedBy && <Badge variant="outline">claimed</Badge>}
                    </div>
                    <Link
                      to="/apps/$accountId/$gatewayId"
                      params={{ accountId, gatewayId: app.gatewayId }}
                      className="font-medium hover:underline break-all"
                    >
                      {app.metadata?.title ?? app.gatewayId}
                    </Link>
                    <div className="text-xs font-mono text-muted-foreground break-all">
                      {app.gatewayId}
                    </div>
                  </div>

                  <div className="text-xs font-mono text-muted-foreground">
                    {app.extends ?? "direct"}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed min-h-10">
                  {app.metadata?.description ??
                    "No FastKV metadata published yet for this gateway."}
                </p>

                <div className="rounded-sm border border-border bg-muted/10 p-3 text-xs font-mono text-muted-foreground break-all">
                  {app.hostUrl ?? app.uiUrl ?? app.apiUrl ?? app.canonicalKey}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link
                      to="/apps/$accountId/$gatewayId"
                      params={{ accountId, gatewayId: app.gatewayId }}
                    >
                      inspect runtime
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted/10 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
