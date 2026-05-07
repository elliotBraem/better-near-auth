import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, Input } from "@/components";
import { useApiClient } from "@/lib/use-api-client";

export const Route = createFileRoute("/_layout/_authenticated/projects/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} | Project | app` },
      {
        name: "description",
        content: `Project details and linked apps.`,
      },
    ],
  }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const [accountId, setAccountId] = useState("");
  const [gatewayId, setGatewayId] = useState("");

  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: () => apiClient.projects.getProject({ id }),
  });

  const linkAppMutation = useMutation({
    mutationFn: () => apiClient.projects.linkAppToProject({ projectId: id, accountId, gatewayId }),
    onSuccess: () => {
      toast.success("App linked to project");
      setAccountId("");
      setGatewayId("");
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to link app");
    },
  });

  const unlinkAppMutation = useMutation({
    mutationFn: (app: { accountId: string; gatewayId: string }) =>
      apiClient.projects.unlinkAppFromProject({ projectId: id, ...app }),
    onSuccess: () => {
      toast.success("App unlinked from project");
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unlink app");
    },
  });

  if (projectQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Loading project...
        </CardContent>
      </Card>
    );
  }

  if (projectQuery.isError || !projectQuery.data?.data) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <p className="text-sm">Project not found or you don't have access.</p>
          <Button asChild variant="outline" size="sm">
            <a href="/home">back to home</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const project = projectQuery.data.data;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          <a href="/home" className="hover:text-foreground transition-colors">
            home
          </a>
          <span>/</span>
          <span>projects</span>
          <span>/</span>
          <span>{project.slug}</span>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">project</Badge>
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
              <Badge
                variant={
                  project.visibility === "public"
                    ? "default"
                    : project.visibility === "unlisted"
                      ? "secondary"
                      : "outline"
                }
              >
                {project.visibility}
              </Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{project.title}</h1>
              {project.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>

            <div className="grid gap-3 text-xs font-mono text-muted-foreground">
              <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
                <span className="uppercase tracking-wide">id</span>
                <span className="break-all">{project.id}</span>
              </div>
              <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
                <span className="uppercase tracking-wide">slug</span>
                <span className="break-all">{project.slug}</span>
              </div>
              <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
                <span className="uppercase tracking-wide">owner</span>
                <span className="break-all">{project.ownerId}</span>
              </div>
              {project.organizationId && (
                <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
                  <span className="uppercase tracking-wide">organization</span>
                  <a
                    href={`/organizations/${project.organizationId}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {project.organizationId}
                  </a>
                </div>
              )}
              <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
                <span className="uppercase tracking-wide">created</span>
                <span>{new Date(project.createdAt).toLocaleString()}</span>
              </div>
              <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
                <span className="uppercase tracking-wide">updated</span>
                <span>{new Date(project.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Linked Apps</h2>
            <p className="text-sm text-muted-foreground">NEAR apps included in this project.</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Link App</div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="account ID (e.g., alice.near)"
                  className="font-mono text-sm"
                />
                <Input
                  value={gatewayId}
                  onChange={(e) => setGatewayId(e.target.value)}
                  placeholder="gateway ID"
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() => linkAppMutation.mutate()}
                  disabled={!accountId.trim() || !gatewayId.trim() || linkAppMutation.isPending}
                  size="sm"
                >
                  {linkAppMutation.isPending ? "linking..." : "link"}
                </Button>
              </div>
            </div>

            {project.apps.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No apps linked to this project yet.
              </div>
            ) : (
              <div className="space-y-3">
                {project.apps.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-sm border border-border bg-muted/10 p-4 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <a
                        href={`/apps/${encodeURIComponent(app.accountId)}/${encodeURIComponent(app.gatewayId)}`}
                        className="font-medium hover:underline break-all"
                      >
                        {app.accountId} / {app.gatewayId}
                      </a>
                      <div className="text-xs text-muted-foreground">
                        Position: {app.position} • Added{" "}
                        {new Date(app.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        unlinkAppMutation.mutate({
                          accountId: app.accountId,
                          gatewayId: app.gatewayId,
                        })
                      }
                      disabled={unlinkAppMutation.isPending}
                    >
                      unlink
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
