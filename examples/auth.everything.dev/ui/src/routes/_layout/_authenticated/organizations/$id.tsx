import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getAuthClient, type Organization, type SessionData } from "@/app";
import { Badge, Button, Card, CardContent, Input } from "@/components";
import { useApiClient } from "@/lib/use-api-client";

type ApiClient = import("@/app").ApiClient;
type OrgApiKeysResult = Awaited<ReturnType<ApiClient["auth"]["listApiKeys"]>>;
type CreatedApiKey = Awaited<ReturnType<ApiClient["auth"]["createApiKey"]>>;
type OrgMembersResult = Awaited<ReturnType<ApiClient["auth"]["listMembers"]>>;
type OrgInvitationsResult = Awaited<ReturnType<ApiClient["auth"]["listInvitations"]>>;

const orgMembersQueryKey = (orgId: string) => ["org-members", orgId] as const;
const orgInvitationsQueryKey = (orgId: string) => ["org-invitations", orgId] as const;
const orgApiKeysQueryKey = (orgId: string) => ["org-api-keys", orgId] as const;

export const Route = createFileRoute("/_layout/_authenticated/organizations/$id")({
  loader: async ({
    context,
    params,
  }: {
    context: { queryClient: QueryClient; apiClient: ApiClient };
    params: { id: string };
  }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ["organizations"],
        queryFn: async () => {
          const { data } = await getAuthClient().organization.list();
          return (data || []) as Organization[];
        },
        staleTime: 30 * 1000,
      }),
      context.queryClient.ensureQueryData({
        queryKey: orgMembersQueryKey(params.id),
        queryFn: async (): Promise<OrgMembersResult> =>
          context.apiClient.auth.listMembers({ organizationId: params.id }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: orgInvitationsQueryKey(params.id),
        queryFn: async (): Promise<OrgInvitationsResult> =>
          context.apiClient.auth.listInvitations({ organizationId: params.id }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: orgApiKeysQueryKey(params.id),
        queryFn: async (): Promise<OrgApiKeysResult> =>
          context.apiClient.auth.listApiKeys({ organizationId: params.id }),
      }),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Organization | app" },
      { name: "description", content: "Manage organization details and members." },
    ],
  }),
  component: OrganizationDetail,
});

function OrganizationDetail() {
  const queryClient = useQueryClient();
  const { id: orgId } = Route.useParams();
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
  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data } = await auth.organization.list();
      return (data || []) as Organization[];
    },
    staleTime: 30 * 1000,
  });
  const membersQuery = useQuery({
    queryKey: orgMembersQueryKey(orgId),
    queryFn: async (): Promise<OrgMembersResult> =>
      apiClient.auth.listMembers({ organizationId: orgId }),
  });
  const invitationsQuery = useQuery({
    queryKey: orgInvitationsQueryKey(orgId),
    queryFn: async (): Promise<OrgInvitationsResult> =>
      apiClient.auth.listInvitations({ organizationId: orgId }),
  });
  const apiKeysQuery = useQuery({
    queryKey: orgApiKeysQueryKey(orgId),
    queryFn: async (): Promise<OrgApiKeysResult> =>
      apiClient.auth.listApiKeys({ organizationId: orgId }),
  });

  const org = organizations.find((o: Organization) => o.id === orgId);
  const activeOrgId = session?.session?.activeOrganizationId;
  const isActive = orgId === activeOrgId;
  const members = membersQuery.data || [];
  const invitations = invitationsQuery.data || [];
  const apiKeys = apiKeysQuery.data || [];

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("");
  const [createdApiKey, setCreatedApiKey] = useState<CreatedApiKey | null>(null);

  const handleCopyApiKey = async (value: string, message = "API key copied") => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Failed to copy API key");
    }
  };

  const switchOrgMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.organization.setActive({ organizationId: orgId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Switched to this organization"),
    onError: (error: Error) => toast.error(error.message || "Failed to switch organization"),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.organization.inviteMember({
        organizationId: orgId,
        email: inviteEmail,
        role: inviteRole,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setShowInviteForm(false);
      await queryClient.invalidateQueries({ queryKey: ["org-invitations", orgId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => apiClient.auth.cancelInvitation({ id: invitationId }),
    onSuccess: async () => {
      toast.success("Invitation cancelled");
      await queryClient.invalidateQueries({ queryKey: ["org-invitations", orgId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel invitation");
    },
  });

  const createApiKeyMutation = useMutation({
    mutationFn: () => apiClient.auth.createApiKey({ organizationId: orgId, name: apiKeyName }),
    onSuccess: async (data) => {
      setCreatedApiKey(data);
      toast.success("API key created");
      setApiKeyName("");
      setShowApiKeyForm(false);
      await queryClient.invalidateQueries({
        queryKey: orgApiKeysQueryKey(orgId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create API key");
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => apiClient.auth.deleteApiKey({ id: keyId }),
    onMutate: async (keyId) => {
      await queryClient.cancelQueries({
        queryKey: orgApiKeysQueryKey(orgId),
      });
      const previousKeys = queryClient.getQueryData<OrgApiKeysResult>(orgApiKeysQueryKey(orgId));

      queryClient.setQueryData<OrgApiKeysResult>(
        orgApiKeysQueryKey(orgId),
        (current: OrgApiKeysResult | undefined) => {
          if (!current) return current;
          return current.filter((key) => key.id !== keyId);
        },
      );

      return { previousKeys };
    },
    onSuccess: async () => {
      toast.success("API key deleted");
      await queryClient.invalidateQueries({
        queryKey: orgApiKeysQueryKey(orgId),
      });
    },
    onError: (error: Error, _keyId, context) => {
      if (context?.previousKeys) {
        queryClient.setQueryData(orgApiKeysQueryKey(orgId), context.previousKeys);
      }
      toast.error(error.message || "Failed to delete API key");
    },
  });

  if (!org) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <p className="text-sm">This organization does not exist or you do not have access.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/organizations">back to organizations</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          <Link to="/organizations" className="hover:text-foreground transition-colors">
            organizations
          </Link>
          <span>/</span>
          <span>{org.slug}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardContent className="p-6 sm:p-8 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">organization</Badge>
                {isActive && <Badge variant="outline">active</Badge>}
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{org.name}</h1>
                <p className="text-sm text-muted-foreground font-mono">@{org.slug}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Manage membership, invitations, and organization-scoped API access from one place.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isActive && (
                  <Button
                    onClick={() => switchOrgMutation.mutate()}
                    disabled={switchOrgMutation.isPending}
                    size="sm"
                  >
                    {switchOrgMutation.isPending ? "switching..." : "switch to org"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteForm((value) => !value)}
                >
                  {showInviteForm ? "close invite" : "invite member"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKeyForm((value) => !value)}
                >
                  {showApiKeyForm ? "close key form" : "new api key"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <StatBox label="members" value={String(members.length)} />
              <StatBox label="invitations" value={String(invitations.length)} />
              <StatBox label="api keys" value={String(apiKeys.length)} />
              <StatBox
                label="created"
                value={org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "-"}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">details</div>
            <InfoRow label="id" value={org.id} mono />
            <InfoRow label="name" value={org.name} />
            <InfoRow label="slug" value={`@${org.slug}`} mono />
            <InfoRow
              label="created"
              value={org.createdAt ? new Date(org.createdAt).toLocaleString() : "-"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">navigator</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <NavTile title="workspace" body="return to the workspace overview" to="/home" />
              <NavTile
                title="organizations"
                body="switch back to the org list"
                to="/organizations"
              />
              <NavTile
                title="settings"
                body="link auth methods and update identity"
                to="/settings"
              />
              <NavTile title="published apps" body="jump back to runtime discovery" href="/apps" />
            </div>
          </CardContent>
        </Card>
      </section>

      {showInviteForm && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="font-medium">Invite member</div>
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="email@example.com"
              />
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as "admin" | "member")}
                className="w-full px-3 py-2 text-sm bg-card border-2 border-inset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !inviteEmail}
              variant="outline"
              size="sm"
            >
              {inviteMutation.isPending ? "sending..." : "send invitation"}
            </Button>
          </CardContent>
        </Card>
      )}

      {showApiKeyForm && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="font-medium">Create API key</div>
            <Input
              type="text"
              value={apiKeyName}
              onChange={(event) => setApiKeyName(event.target.value)}
              placeholder="API key name"
            />
            <Button
              onClick={() => createApiKeyMutation.mutate()}
              disabled={createApiKeyMutation.isPending || !apiKeyName}
              variant="outline"
              size="sm"
            >
              {createApiKeyMutation.isPending ? "creating..." : "create key"}
            </Button>
          </CardContent>
        </Card>
      )}

      {createdApiKey && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium">New API key ready</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Copy and store this key now. You will only be able to see the full secret once.
                </p>
              </div>
              <Button onClick={() => setCreatedApiKey(null)} variant="outline" size="sm">
                dismiss
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                readOnly
                value={createdApiKey.key}
                className="font-mono text-xs"
                onFocus={(event) => event.target.select()}
                onClick={(event) => event.currentTarget.select()}
              />
              <Button
                onClick={() => handleCopyApiKey(createdApiKey.key)}
                variant="outline"
                size="sm"
              >
                copy key
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="name" value={createdApiKey.name ?? "unnamed"} />
              <InfoRow label="prefix" value={`${createdApiKey.prefix ?? "api_"}...`} mono />
              <InfoRow label="created" value={new Date(createdApiKey.createdAt).toLocaleString()} />
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <SectionHeader title={`Members (${members.length})`} />
        {membersQuery.isLoading ? (
          <LoadingCard label="Loading members..." />
        ) : members.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium break-all">{member.userId}</div>
                    <Badge variant="outline">{member.role}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono break-all">
                    {member.userId}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyCard label="No members found" />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title={`Pending Invitations (${invitations.length})`} />
        {invitationsQuery.isLoading ? (
          <LoadingCard label="Loading invitations..." />
        ) : invitations.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {invitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium break-all">{invitation.email}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {invitation.role}
                      </div>
                    </div>
                    <Button
                      onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                      disabled={cancelInvitationMutation.isPending}
                      variant="outline"
                      size="sm"
                    >
                      cancel
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    expires {new Date(invitation.expiresAt).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyCard label="No pending invitations" />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title={`API Keys (${apiKeys.length})`} />
        {apiKeysQuery.isLoading ? (
          <LoadingCard label="Loading api keys..." />
        ) : apiKeys.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {apiKeys.map((key) => (
              <Card key={key.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="space-y-1">
                    <div className="font-medium break-all">{key.name ?? "unnamed"}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {key.prefix ?? "api_"}...
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    created {new Date(key.createdAt).toLocaleString()}
                  </div>
                  <Button
                    onClick={() => deleteApiKeyMutation.mutate(key.id)}
                    disabled={deleteApiKeyMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    delete key
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyCard label="No API keys" />
        )}
      </section>
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

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-sm border border-border bg-muted/10 p-3 grid gap-1 sm:grid-cols-[100px_1fr] sm:gap-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "text-xs font-mono break-all" : "text-sm break-all"}>{value}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-lg font-semibold tracking-tight">{title}</h2>;
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}

function NavTile({
  title,
  body,
  to,
  href,
}: {
  title: string;
  body: string;
  to?: "/home" | "/organizations" | "/settings";
  href?: string;
}) {
  const tile = (
    <Card className="transition-colors hover:bg-muted/20">
      <CardContent className="p-4 space-y-2">
        <div className="font-medium">{title}</div>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </CardContent>
    </Card>
  );

  if (to) {
    return <Link to={to}>{tile}</Link>;
  }

  return <a href={href}>{tile}</a>;
}
