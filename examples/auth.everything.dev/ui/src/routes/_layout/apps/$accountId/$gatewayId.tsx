import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getAuthClient } from "@/app";
import { Badge, Button, Card, CardContent } from "@/components";
import { Input } from "@/components/ui/input";
import { sessionQueryOptions } from "@/lib/session";
import { useApiClient } from "@/lib/use-api-client";

export const Route = createFileRoute("/_layout/apps/$accountId/$gatewayId")({
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.accountId}/${params.gatewayId} | Published Apps | app`,
      },
      {
        name: "description",
        content: `Runtime details for ${params.accountId} on ${params.gatewayId}.`,
      },
    ],
  }),
  component: AppDetailPage,
});

function AppDetailPage() {
  const { accountId, gatewayId } = Route.useParams();
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const detailQuery = useQuery({
    queryKey: ["registry-app", accountId, gatewayId],
    queryFn: () => apiClient.registry.getRegistryApp({ accountId, gatewayId }),
  });
  const projectsQuery = useQuery({
    queryKey: ["app-projects", accountId, gatewayId],
    queryFn: () => apiClient.projects.listProjectsForApp({ accountId, gatewayId }),
  });
  const registryStatusQuery = useQuery({
    queryKey: ["registry-status"],
    queryFn: () => apiClient.registry.getRegistryStatus(),
    staleTime: 60_000,
  });
  const auth = getAuthClient();
  const { data: session } = useQuery(sessionQueryOptions());

  const nearAccountId = auth.near.getAccountId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [delegatePayload, setDelegatePayload] = useState<string | null>(null);
  const [pendingRefreshUntil, setPendingRefreshUntil] = useState<number | null>(null);

  const app = detailQuery.data?.data;
  const initialMetadata = useMemo(
    () => ({
      title: app?.metadata?.title ?? "",
      description: app?.metadata?.description ?? "",
      repoUrl: app?.metadata?.repoUrl ?? "",
      homepageUrl: app?.metadata?.homepageUrl ?? app?.openUrl ?? app?.hostUrl ?? "",
      imageUrl: app?.metadata?.imageUrl ?? "",
    }),
    [app],
  );

  useEffect(() => {
    setTitle(initialMetadata.title);
    setDescription(initialMetadata.description);
    setRepoUrl(initialMetadata.repoUrl);
    setHomepageUrl(initialMetadata.homepageUrl);
    setImageUrl(initialMetadata.imageUrl);
  }, [initialMetadata]);

  useEffect(() => {
    if (!pendingRefreshUntil) {
      return;
    }

    if (Date.now() > pendingRefreshUntil) {
      setPendingRefreshUntil(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void detailQuery.refetch();
    }, 4_000);

    return () => window.clearTimeout(timer);
  }, [detailQuery, pendingRefreshUntil, app?.metadata?.updatedAt]);

  useEffect(() => {
    if (!pendingRefreshUntil || !app?.metadata?.updatedAt) {
      return;
    }

    setPendingRefreshUntil(null);
  }, [app?.metadata?.updatedAt, pendingRefreshUntil]);

  const prepareMetadataMutation = useMutation({
    mutationFn: async () => {
      if (!nearAccountId) {
        throw new Error("Connect a NEAR wallet to publish registry metadata.");
      }

      return apiClient.registry.prepareRegistryMetadataWrite({
        accountId,
        gatewayId,
        claimedBy: nearAccountId,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
        homepageUrl: homepageUrl.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
    },
  });

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["registry-app", accountId, gatewayId] }),
      queryClient.invalidateQueries({ queryKey: ["registry-account", accountId] }),
      queryClient.invalidateQueries({ queryKey: ["registry-apps"] }),
    ]);
  };

  const publishMetadataMutation = useMutation({
    mutationFn: async () => {
      const prepared = await prepareMetadataMutation.mutateAsync();
      const signerId = auth.near.getAccountId();

      if (!signerId) {
        throw new Error("Connect a NEAR wallet before publishing metadata.");
      }

      const signedDelegateAction = await auth.near.buildSignedDelegateAction(
        prepared.data.contractId,
        (builder) =>
          builder.functionCall(
            prepared.data.contractId,
            prepared.data.methodName,
            prepared.data.args,
            { gas: "10000000000000", attachedDeposit: 0n },
          ),
      );

      const result = await auth.near.relayTransaction({ payload: signedDelegateAction });
      if (result.error) throw new Error(result.error.message || "Relay failed");
      return result.data;
    },
    onSuccess: async (result) => {
      setDelegatePayload(null);
      toast.success("Registry metadata submitted", {
        description: result?.txHash
          ? `Submitted transaction ${result.txHash}. FastKV indexing can still succeed even if the contract call looks failed.`
          : "The transaction was submitted. FastKV indexing can take a moment.",
      });
      await refreshQueries();
      setPendingRefreshUntil(Date.now() + 45_000);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit registry metadata");
    },
  });

  const signDelegateMutation = useMutation({
    mutationFn: async () => {
      const prepared = await prepareMetadataMutation.mutateAsync();
      const signerId = auth.near.getAccountId();

      if (!signerId) {
        throw new Error("Connect a NEAR wallet before signing delegate payloads.");
      }

      const signedDelegateAction = await auth.near.buildSignedDelegateAction(
        prepared.data.contractId,
        (builder) =>
          builder.functionCall(
            prepared.data.contractId,
            prepared.data.methodName,
            prepared.data.args,
            { gas: "10000000000000", attachedDeposit: 0n },
          ),
      );

      return signedDelegateAction;
    },
    onSuccess: (payload: string) => {
      setDelegatePayload(payload);
      toast.success("Delegate payload signed", {
        description: payload
          ? "Copy the payload below or use the relay button if this host is configured to sponsor submissions."
          : "Signed delegate action is ready.",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sign delegate payload");
    },
  });

  const relayMetadataMutation = useMutation({
    mutationFn: async () => {
      if (!delegatePayload) {
        throw new Error("Sign a delegate payload first.");
      }

      const result = await auth.near.relayTransaction({
        payload: delegatePayload,
      });
      if (result.error) throw new Error(result.error.message || "Relay failed");
      return result.data;
    },
    onSuccess: async (result) => {
      toast.success("Delegate payload relayed", {
        description: result?.txHash
          ? `Submitted relayed transaction ${result.txHash}.`
          : "Relay submitted the signed delegate action.",
      });
      await refreshQueries();
      setPendingRefreshUntil(Date.now() + 45_000);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to relay delegate payload");
    },
  });

  if (detailQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Loading published runtime...
        </CardContent>
      </Card>
    );
  }

  if (!app) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <p className="text-sm">This published runtime could not be resolved.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/apps" search={{}}>
              back to apps
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          <Link to="/apps" search={{}} className="hover:text-foreground transition-colors">
            apps
          </Link>
          <span>/</span>
          <Link
            to="/apps/$accountId"
            params={{ accountId }}
            className="hover:text-foreground transition-colors"
          >
            {accountId}
          </Link>
          <span>/</span>
          <span>{gatewayId}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card id="overview">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={app.status === "ready" ? "default" : "destructive"}>
                  {app.status}
                </Badge>
                {app.metadata?.claimedBy ? (
                  <Badge variant="outline">claimed by {app.metadata.claimedBy}</Badge>
                ) : (
                  <Badge variant="outline">unclaimed metadata</Badge>
                )}
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight break-all">
                  {app.metadata?.title ?? `${accountId} / ${gatewayId}`}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {app.metadata?.description ??
                    "This runtime has no public FastKV metadata yet. You can still inspect its canonical config and launch targets below."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {app.openUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a href={app.openUrl} target="_blank" rel="noreferrer">
                      open app
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm">
                  <a href={app.canonicalConfigUrl} target="_blank" rel="noreferrer">
                    view FastKV config
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(app.startCommand);
                    toast.success("bos start command copied");
                  }}
                >
                  copy bos start
                </Button>
                {app.metadata?.repoUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a href={app.metadata.repoUrl} target="_blank" rel="noreferrer">
                      repo
                    </a>
                  </Button>
                )}
                {app.metadata?.homepageUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a href={app.metadata.homepageUrl} target="_blank" rel="noreferrer">
                      homepage
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">navigator</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <AnchorButton href="#overview" label="overview" />
                <AnchorButton href="#runtime" label="runtime" />
                <AnchorButton href="#config" label="config" />
                <AnchorButton href="#metadata" label="metadata" />
                <AnchorButton href="#publish" label="claim / publish" />
              </div>
              <div className="pt-3 border-t border-border text-xs font-mono text-muted-foreground break-all">
                {app.metadataContractId}:{app.metadataKey}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="account" value={accountId} mono />
        <MetricCard label="gateway" value={gatewayId} mono />
        <MetricCard label="extends" value={app.extends ?? "direct"} mono />
        <MetricCard
          label="relay"
          value={registryStatusQuery.data?.relayEnabled ? "enabled" : "disabled"}
        />
      </section>

      <Card id="runtime">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Runtime</h2>
            <p className="text-sm text-muted-foreground">
              Resolved runtime values from the published config chain.
            </p>
          </div>

          <div className="grid gap-3 text-sm">
            <RuntimeRow label="host" value={app.hostUrl} />
            <RuntimeRow label="ui" value={app.uiUrl} />
            <RuntimeRow label="ui ssr" value={app.uiSsrUrl} />
            <RuntimeRow label="api" value={app.apiUrl} />
            <RuntimeRow label="canonical key" value={app.canonicalKey} />
            <RuntimeRow label="bos start" value={app.startCommand} />
            <RuntimeRow label="extends" value={app.extends} />
          </div>
        </CardContent>
      </Card>

      <section id="config" className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Resolved Config</h2>
          <p className="text-sm text-muted-foreground">
            The live resolved <code>bos.config.json</code> for this app, fetched from FastKV and
            merged with any inherited values.
          </p>
        </div>
        <pre className="overflow-x-auto text-xs leading-relaxed text-muted-foreground font-mono whitespace-pre">
          {JSON.stringify(app.resolvedConfig, null, 2)}
        </pre>
      </section>

      <Card id="metadata">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Registry Metadata</h2>
            <p className="text-sm text-muted-foreground">
              Public FastKV manifest data attached to this runtime.
            </p>
          </div>

          {app.metadata ? (
            <div className="grid gap-3 text-sm">
              <RuntimeRow label="claimed by" value={app.metadata.claimedBy} />
              <RuntimeRow label="title" value={app.metadata.title} />
              <RuntimeRow label="description" value={app.metadata.description} />
              <RuntimeRow label="repo" value={app.metadata.repoUrl} />
              <RuntimeRow label="homepage" value={app.metadata.homepageUrl} />
              <RuntimeRow label="image" value={app.metadata.imageUrl} />
              <RuntimeRow label="updated" value={app.metadata.updatedAt} />
            </div>
          ) : (
            <div className="rounded-sm border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
              No FastKV metadata has been published for this runtime yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="projects">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">In Projects</h2>
            <p className="text-sm text-muted-foreground">Projects that include this app.</p>
          </div>

          {projectsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading projects...</div>
          ) : projectsQuery.data?.data && projectsQuery.data.data.length > 0 ? (
            <div className="space-y-3">
              {projectsQuery.data.data.map((project: (typeof projectsQuery.data.data)[number]) => (
                <div
                  key={project.id}
                  className="rounded-sm border border-border bg-muted/10 p-4 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          project.status === "active"
                            ? "default"
                            : project.status === "paused"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {project.status}
                      </Badge>
                      <Badge variant="outline">{project.visibility}</Badge>
                    </div>
                    <Link
                      to="/projects/$id"
                      params={{ id: project.id }}
                      className="font-medium hover:underline break-all"
                    >
                      {project.title}
                    </Link>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/projects/$id" params={{ id: project.id }}>
                      view
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              This app is not included in any projects yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="publish">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Claim / Edit Metadata</h2>
            <p className="text-sm text-muted-foreground">
              Publish a FastKV manifest for this runtime, either directly from your wallet or
              through a sponsored relay when available.
            </p>
          </div>

          {!session?.user ? (
            <div className="rounded-sm border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
              Sign in first, then link a NEAR wallet to publish metadata for this app.
            </div>
          ) : !nearAccountId ? (
            <div className="rounded-sm border border-border bg-muted/10 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Your account session is active, but no NEAR wallet is linked for publishing.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings">open settings</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="title" htmlFor="registry-title">
                  <Input
                    id="registry-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                <Field label="repo url" htmlFor="registry-repo-url">
                  <Input
                    id="registry-repo-url"
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                  />
                </Field>
                <Field label="homepage url" htmlFor="registry-homepage-url">
                  <Input
                    id="registry-homepage-url"
                    value={homepageUrl}
                    onChange={(event) => setHomepageUrl(event.target.value)}
                  />
                </Field>
                <Field label="image url" htmlFor="registry-image-url">
                  <Input
                    id="registry-image-url"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                  />
                </Field>
              </div>

              <Field label="description" htmlFor="registry-description">
                <textarea
                  id="registry-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  className="flex min-h-[120px] w-full rounded-md border-2 border-inset border-[rgb(51,51,51)] bg-[rgb(255,255,255)] px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus:ring-2 focus:ring-ring dark:bg-[rgb(40,40,40)] dark:border-[rgb(100,100,100)]"
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-3">
                <ActionCard
                  title="publish now"
                  body="Submit a direct `__fastdata_kv` transaction from your linked wallet."
                  buttonLabel={publishMetadataMutation.isPending ? "publishing..." : "publish now"}
                  onClick={() => publishMetadataMutation.mutate()}
                  disabled={
                    publishMetadataMutation.isPending ||
                    signDelegateMutation.isPending ||
                    relayMetadataMutation.isPending
                  }
                />
                <ActionCard
                  title="sign delegate"
                  body="Create a signed delegate payload that can be copied or relayed later."
                  buttonLabel={signDelegateMutation.isPending ? "signing..." : "sign payload"}
                  onClick={() => signDelegateMutation.mutate()}
                  disabled={
                    publishMetadataMutation.isPending ||
                    signDelegateMutation.isPending ||
                    relayMetadataMutation.isPending
                  }
                />
                <ActionCard
                  title="relay payload"
                  body={
                    registryStatusQuery.data?.relayEnabled
                      ? "Use the configured relayer account on this host."
                      : "Relay is not configured on this host yet."
                  }
                  buttonLabel={relayMetadataMutation.isPending ? "relaying..." : "relay payload"}
                  onClick={() => relayMetadataMutation.mutate()}
                  disabled={
                    !registryStatusQuery.data?.relayEnabled ||
                    !delegatePayload ||
                    publishMetadataMutation.isPending ||
                    signDelegateMutation.isPending ||
                    relayMetadataMutation.isPending
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <InfoBox
                  title="relay status"
                  body={
                    registryStatusQuery.data?.relayEnabled
                      ? `enabled via ${registryStatusQuery.data.relayAccountId ?? "configured relayer"}`
                      : "disabled on this host"
                  }
                />
                <InfoBox
                  title="indexing"
                  body={pendingRefreshUntil ? "rechecking FastKV for fresh metadata now" : "idle"}
                />
              </div>

              <div className="text-xs text-muted-foreground">
                Direct publish uses `waitUntil: NONE`. Wallets may show the contract call as failed
                while FastKV still indexes the transaction arguments successfully.
              </div>

              {delegatePayload && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        delegate payload
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard.writeText(delegatePayload);
                          toast.success("Delegate payload copied");
                        }}
                      >
                        copy payload
                      </Button>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs font-mono text-foreground">
                      {delegatePayload}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnchorButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-sm border border-border bg-muted/10 px-3 py-2 text-sm hover:bg-muted/20 transition-colors"
    >
      {label}
    </a>
  );
}

function MetricCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div
          className={mono ? "text-sm font-mono break-all" : "text-xl font-semibold tracking-tight"}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  title,
  body,
  buttonLabel,
  onClick,
  disabled,
}: {
  title: string;
  body: string;
  buttonLabel: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <div className="font-medium">{title}</div>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function InfoBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted/10 p-4 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="text-sm text-muted-foreground break-all">{body}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 block">
      <label htmlFor={htmlFor} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function RuntimeRow({ label, value }: { label: string; value: string | null }) {
  const isUrl = Boolean(value && /^https?:\/\//.test(value));

  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4 rounded-sm border border-border bg-muted/10 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-xs break-all text-foreground">
        {isUrl ? (
          <a
            href={value ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {value}
          </a>
        ) : (
          (value ?? "-")
        )}
      </div>
    </div>
  );
}
