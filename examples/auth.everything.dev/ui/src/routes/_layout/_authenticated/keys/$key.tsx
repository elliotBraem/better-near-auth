import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, CardContent } from "@/components";
import { useApiClient } from "@/lib/use-api-client";

export type KvValueResult = Awaited<ReturnType<import("@/app").ApiClient["projects"]["getValue"]>>;

function generateOgImageSvg(keyId: string): string {
  const escapedKey = keyId.length > 40 ? `${keyId.slice(0, 37)}...` : keyId;
  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#171717"/>
    <text x="600" y="315" font-family="monospace" font-size="48" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapedKey}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export const Route = createFileRoute("/_layout/_authenticated/keys/$key")({
  loader: async ({ context, params }) => {
    try {
      const data = await context.apiClient.projects.getValue({ key: params.key });
      return { data };
    } catch (error) {
      return { error: error as Error, data: null };
    }
  },
  head: ({ params, loaderData }) => {
    const keyName = params.key;
    const hasData = loaderData?.data !== null;
    const title = `Key: ${keyName} | app`;
    const description = hasData
      ? `View the value for key "${keyName}" in the key-value store.`
      : `Key "${keyName}" not found in the store.`;
    const ogImage = generateOgImageSvg(keyName);

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:image", content: ogImage },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
      ],
    };
  },
  component: KeyValue,
});

function KeyValue() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const { key } = Route.useParams();
  const { data, error } = Route.useLoaderData();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.projects.deleteKey({ key }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["kv-keys"] });
      router.navigate({ to: "/keys" });
    },
  });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          <Link to="/keys" className="hover:text-foreground transition-colors">
            keys
          </Link>
          <span>/</span>
          <span className="break-all">{key}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">kv key</Badge>
                {data ? (
                  <Badge variant="outline">present</Badge>
                ) : (
                  <Badge variant="outline">missing</Badge>
                )}
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight break-all">
                  {key}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Inspect the stored value, copy the payload, or remove the key entirely from the
                  test KV store.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/keys">back to keys</Link>
                </Button>
                {data && (
                  <Button
                    onClick={async () => {
                      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                    }}
                    variant="outline"
                    size="sm"
                  >
                    copy value
                  </Button>
                )}
                {data && (
                  <Button
                    onClick={() => setShowDeleteConfirm((value) => !value)}
                    disabled={deleteMutation.isPending}
                    variant="destructive"
                    size="sm"
                  >
                    {deleteMutation.isPending
                      ? "deleting..."
                      : showDeleteConfirm
                        ? "cancel delete"
                        : "delete key"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <StatBox label="state" value={data ? "present" : "missing"} />
              <StatBox label="error" value={error ? "yes" : "no"} />
            </CardContent>
          </Card>
        </div>
      </section>

      {showDeleteConfirm && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="font-medium">Confirm delete</div>
            <p className="text-sm text-muted-foreground break-all">
              Are you sure you want to delete key "{key}"?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                variant="destructive"
                size="sm"
              >
                {deleteMutation.isPending ? "deleting..." : "confirm delete"}
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
                variant="outline"
                size="sm"
              >
                keep key
              </Button>
            </div>
            {deleteMutation.isError && (
              <p className="text-xs text-destructive">
                {deleteMutation.error?.message || "Failed to delete key"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">value</div>
          {error ? (
            <div className="rounded-sm border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Error: {error.message || "Failed to load key"}
            </div>
          ) : data ? (
            <pre className="overflow-auto rounded-sm border border-border bg-muted/10 p-4 text-xs font-mono text-foreground">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <div className="rounded-sm border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
              No value found for key "{key}".
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted/10 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight break-all">{value}</div>
    </div>
  );
}
