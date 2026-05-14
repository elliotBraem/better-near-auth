import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Building2, Mail, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { type Organization, type SessionData, useAuthClient } from "@/app";
import { Badge, Button, Card, CardContent, Skeleton } from "@/components";

type AuthClientType = import("@/app").AuthClient;
type UserInvitationsResponse = Awaited<
  ReturnType<AuthClientType["organization"]["listUserInvitations"]>
>;
type UserInvitationItem = NonNullable<UserInvitationsResponse["data"]>[number];

export const Route = createFileRoute("/_layout/_authenticated/organizations/")({
  head: () => ({
    title: "Organizations | auth.everything.dev",
    meta: [
      { name: "description", content: "Manage your organizations and teams." },
    ],
  }),
  component: OrganizationsList,
});

function OrganizationsList() {
  const auth = useAuthClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useQuery<SessionData | null>({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await auth.getSession();
      return data ?? null;
    },
    staleTime: 60 * 1000,
  });
  const { data: organizations, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data } = await auth.organization.list();
      return (data || []) as Organization[];
    },
    staleTime: 30 * 1000,
  });

  const { data: userInvitations = [] } = useQuery({
    queryKey: ["user-invitations"],
    queryFn: async (): Promise<UserInvitationItem[]> => {
      const { data, error } = await auth.organization.listUserInvitations();
      if (error) throw new Error(error.message);
      return (data ?? []) as UserInvitationItem[];
    },
    staleTime: 30 * 1000,
  });

  const pendingInvitations = userInvitations.filter((i) => i.status === "pending");

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitation: UserInvitationItem) => {
      const { error } = await auth.organization.acceptInvitation({
        invitationId: invitation.id,
      });
      if (error) throw new Error(error.message);
      return invitation;
    },
    onSuccess: async (invitation) => {
      toast.success(`Joined ${invitation.organizationName ?? "organization"}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizations"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: ["user-invitations"] }),
      ]);
      await queryClient.refetchQueries({ queryKey: ["organizations"] });
      if (invitation.organizationSlug) {
        await router.navigate({
          to: "/organizations/$slug",
          params: { slug: invitation.organizationSlug },
        });
      }
    },
    onError: (error: Error) => toast.error(error.message || "Failed to accept invitation"),
  });

  const rejectInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await auth.organization.rejectInvitation({ invitationId });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Invitation declined");
      await queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to decline invitation"),
  });

  const user = session?.user;
  const activeOrgId = session?.session?.activeOrganizationId;

  const switchOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await auth.organization.setActive({ organizationId: orgId });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Switched organization");
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to switch organization"),
  });

  const orgs = organizations || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Manage workspaces, members, invitations, and organization API keys.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/organizations/new">
            <Plus className="h-4 w-4 mr-1.5" />
            new organization
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="total" value={String(orgs.length)} />
        <StatBox label="active" value={activeOrgId ? "yes" : "no"} />
        <StatBox label="invites" value={String(pendingInvitations.length)} />
      </div>

      {pendingInvitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Pending Invitations ({pendingInvitations.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pendingInvitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 border-2 border-outset border-border flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="font-medium break-all">
                        {invitation.organizationName ?? invitation.organizationSlug}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        invited as {invitation.role ?? "member"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => acceptInvitationMutation.mutate(invitation)}
                      disabled={
                        acceptInvitationMutation.isPending || rejectInvitationMutation.isPending
                      }
                      size="sm"
                    >
                      {acceptInvitationMutation.isPending &&
                      acceptInvitationMutation.variables?.id === invitation.id
                        ? "accepting..."
                        : "accept"}
                    </Button>
                    <Button
                      onClick={() => rejectInvitationMutation.mutate(invitation.id)}
                      disabled={
                        acceptInvitationMutation.isPending || rejectInvitationMutation.isPending
                      }
                      variant="outline"
                      size="sm"
                    >
                      {rejectInvitationMutation.isPending &&
                      rejectInvitationMutation.variables === invitation.id
                        ? "declining..."
                        : "decline"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Card key={`skeleton-${n}`}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-none" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm">No organizations yet.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/organizations/new">create your first org</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map((org: Organization) => {
            const isActive = org.id === activeOrgId;
            const isPersonal = user
              ? org.slug === user.id || (org.metadata as any)?.isPersonal === true
              : false;

            return (
              <Card key={org.id} className="transition-shadow hover:shadow-md">
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
                        <div className="w-10 h-10 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] flex items-center justify-center text-sm font-medium">
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

                  <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/10 p-3 text-sm text-muted-foreground">
                    {org.createdAt
                      ? `created ${new Date(org.createdAt).toLocaleDateString()}`
                      : "organization record"}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to="/organizations/$slug" params={{ slug: org.slug }}>
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
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
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
    <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/10 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
