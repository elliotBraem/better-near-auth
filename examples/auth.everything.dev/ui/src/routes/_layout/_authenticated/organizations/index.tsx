import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { getAuthClient, type Organization, type SessionData } from "@/app";
import { Badge, Button, Card, CardContent, UnderConstruction } from "@/components";

export const Route = createFileRoute("/_layout/_authenticated/organizations/")({
  head: () => ({
    meta: [
      { title: "Organizations | app" },
      { name: "description", content: "Manage your organizations and teams." },
    ],
  }),
  component: OrganizationsList,
});

function OrganizationsList() {
  const auth = getAuthClient();
  const { data: session } = useQuery<SessionData | null>({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await auth.getSession();
      return data ?? null;
    },
    staleTime: 60 * 1000,
  });
  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data } = await auth.organization.list();
      return (data || []) as Organization[];
    },
    staleTime: 30 * 1000,
  });

  const user = session?.user;
  const activeOrgId = session?.session?.activeOrganizationId;

  const switchOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await auth.organization.setActive({ organizationId: orgId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Switched organization"),
    onError: (error: Error) => toast.error(error.message || "Failed to switch organization"),
  });

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">organizations</Badge>
              {activeOrgId && <Badge variant="outline">active set</Badge>}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Workspace Groups
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Switch contexts, create new organizations, and open team-specific member and API key
                management flows.
              </p>
              <UnderConstruction
                label="organizations"
                sourceFile="ui/src/routes/_layout/_authenticated/organizations/index.tsx"
                className="w-full max-w-sm mt-3"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/organizations/new">new organization</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/home">back to workspace</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatBox label="total" value={String(organizations.length)} />
            <StatBox label="active" value={activeOrgId ? "yes" : "no"} />
          </CardContent>
        </Card>
      </section>

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm">No organizations yet.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/organizations/new">create your first org</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((org: Organization) => {
            const isActive = org.id === activeOrgId;
            const isPersonal = user
              ? org.slug === user.id || org.metadata?.isPersonal === true
              : false;

            return (
              <Card key={org.id}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {org.logo ? (
                        <img
                          src={org.logo}
                          alt=""
                          className="w-10 h-10 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] flex items-center justify-center text-sm">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium break-all">{org.name}</div>
                          {isActive && <Badge variant="outline">active</Badge>}
                          {isPersonal && <Badge variant="outline">personal</Badge>}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">@{org.slug}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-sm border border-border bg-muted/10 p-3 text-sm text-muted-foreground">
                    {org.createdAt
                      ? `created ${new Date(org.createdAt).toLocaleDateString()}`
                      : "organization record"}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to="/organizations/$id" params={{ id: org.id }}>
                        open org
                      </Link>
                    </Button>
                    {!isActive && (
                      <Button
                        onClick={() => switchOrgMutation.mutate(org.id)}
                        disabled={switchOrgMutation.isPending}
                        variant="outline"
                        size="sm"
                      >
                        switch
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground leading-relaxed">
          Each user gets a personal organization automatically. Additional organizations give teams
          their own members, invitations, and API key scope.
        </CardContent>
      </Card>
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
