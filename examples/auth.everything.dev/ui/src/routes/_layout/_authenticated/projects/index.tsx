import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getAuthClient, type SessionData } from "@/app";
import { Badge, Button, Card, CardContent } from "@/components";
import { useApiClient } from "@/lib/use-api-client";

export const Route = createFileRoute("/_layout/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects | app" },
      { name: "description", content: "Manage your projects and linked apps." },
    ],
  }),
  component: ProjectsList,
});

function ProjectsList() {
  const apiClient = useApiClient();
  const auth = getAuthClient();
  const { data: session } = useQuery<SessionData | null>({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await auth.getSession();
      return data ?? null;
    },
    staleTime: 60 * 1000,
  });

  const user = session?.user;

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.projects.listProjects({ ownerId: user?.id, limit: 50 }),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Projects organize your NEAR apps into groups.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/projects/new">new project</Link>
          </Button>
        </div>

        {projectsData?.data && projectsData.data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {projectsData.data.map((project) => (
              <Card key={project.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                No projects yet. Create your first project to start organizing apps.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/projects/new">create project</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
