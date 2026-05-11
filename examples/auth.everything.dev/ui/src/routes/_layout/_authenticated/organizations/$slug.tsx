import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Edit2, Key, Mail, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type AuthClient,
  type Organization,
  type SessionData,
  useApiClient,
  useAuthClient,
} from "@/app";
import {
  ApiKeyForm,
  ApiKeyReveal,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  InvitationCard,
  MemberCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components";

type ApiClient = import("@/app").ApiClient;
type OrgApiKeysResult = Awaited<ReturnType<ApiClient["auth"]["listApiKeys"]>>;
type CreatedApiKey = Awaited<ReturnType<ApiClient["auth"]["createApiKey"]>>;
type OrgMembersResult = Awaited<ReturnType<ApiClient["auth"]["listMembers"]>>;
type OrgInvitationsResult = Awaited<ReturnType<ApiClient["auth"]["listInvitations"]>>;

const orgMembersQueryKey = (orgId: string) => ["org-members", orgId] as const;
const orgInvitationsQueryKey = (orgId: string) => ["org-invitations", orgId] as const;
const orgApiKeysQueryKey = (orgId: string) => ["org-api-keys", orgId] as const;

export const Route = createFileRoute("/_layout/_authenticated/organizations/$slug")({
  loader: async ({
    context,
    params,
  }: {
    context: { queryClient: QueryClient; apiClient: ApiClient; authClient: AuthClient };
    params: { slug: string };
  }) => {
    const orgs = await context.queryClient.ensureQueryData({
      queryKey: ["organizations"],
      queryFn: async () => {
        const { data } = await context.authClient.organization.list();
        return (data || []) as Organization[];
      },
      staleTime: 30 * 1000,
    });

    const org = orgs.find((o: Organization) => o.slug === params.slug);
    const orgId = org?.id;

    if (!orgId) throw notFound();

    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: orgMembersQueryKey(orgId),
        queryFn: async (): Promise<OrgMembersResult> =>
          context.apiClient.auth.listMembers({ organizationId: orgId }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: orgInvitationsQueryKey(orgId),
        queryFn: async (): Promise<OrgInvitationsResult> =>
          context.apiClient.auth.listInvitations({ organizationId: orgId }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: orgApiKeysQueryKey(orgId),
        queryFn: async (): Promise<OrgApiKeysResult> =>
          context.apiClient.auth.listApiKeys({ organizationId: orgId }),
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
  const { slug: orgSlug } = Route.useParams();
  const apiClient = useApiClient();
  const auth = useAuthClient();
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

  const org = organizations.find((o: Organization) => o.slug === orgSlug);
  const orgId = org?.id ?? "";
  const activeOrgId = session?.session?.activeOrganizationId;
  const isActive = orgId === activeOrgId;
  const members =
    useQuery({
      queryKey: orgMembersQueryKey(orgId),
      queryFn: async (): Promise<OrgMembersResult> =>
        apiClient.auth.listMembers({ organizationId: orgId }),
      enabled: !!orgId,
    }).data ?? [];
  const invitations =
    useQuery({
      queryKey: orgInvitationsQueryKey(orgId),
      queryFn: async (): Promise<OrgInvitationsResult> =>
        apiClient.auth.listInvitations({ organizationId: orgId }),
      enabled: !!orgId,
    }).data ?? [];
  const apiKeys =
    useQuery({
      queryKey: orgApiKeysQueryKey(orgId),
      queryFn: async (): Promise<OrgApiKeysResult> =>
        apiClient.auth.listApiKeys({ organizationId: orgId }),
      enabled: !!orgId,
    }).data ?? [];

  const myMembership = members.find((m) => m.userId === session?.user?.id);
  const canManageMembers = myMembership?.role === "owner" || myMembership?.role === "admin";
  const isOwner = myMembership?.role === "owner";

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
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
      await queryClient.invalidateQueries({ queryKey: orgInvitationsQueryKey(orgId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => apiClient.auth.cancelInvitation({ id: invitationId }),
    onSuccess: async () => {
      toast.success("Invitation cancelled");
      await queryClient.invalidateQueries({ queryKey: orgInvitationsQueryKey(orgId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel invitation");
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => apiClient.auth.resendInvitation({ id: invitationId }),
    onSuccess: async () => {
      toast.success("Invitation resent");
      await queryClient.invalidateQueries({ queryKey: orgInvitationsQueryKey(orgId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });

  const createApiKeyMutation = useMutation({
    mutationFn: ({ name, permissions }: { name: string; permissions?: Record<string, string[]> }) =>
      apiClient.auth.createApiKey({ organizationId: orgId, name, permissions }),
    onSuccess: async (data) => {
      setCreatedApiKey(data);
      toast.success("API key created");
      await queryClient.invalidateQueries({ queryKey: orgApiKeysQueryKey(orgId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create API key");
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => apiClient.auth.deleteApiKey({ id: keyId }),
    onMutate: async (keyId) => {
      await queryClient.cancelQueries({ queryKey: orgApiKeysQueryKey(orgId) });
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
      await queryClient.invalidateQueries({ queryKey: orgApiKeysQueryKey(orgId) });
    },
    onError: (error: Error, _keyId, context) => {
      if (context?.previousKeys) {
        queryClient.setQueryData(orgApiKeysQueryKey(orgId), context.previousKeys);
      }
      toast.error(error.message || "Failed to delete API key");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiClient.auth.removeMember({ id: memberId, organizationId: orgId }),
    onSuccess: async () => {
      toast.success("Member removed");
      await queryClient.invalidateQueries({ queryKey: orgMembersQueryKey(orgId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove member");
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: ({ name, slug }: { name: string; slug: string }) =>
      apiClient.auth.updateOrganization({ id: orgId, name, slug }),
    onSuccess: async () => {
      toast.success("Organization updated");
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      await queryClient.invalidateQueries({ queryKey: orgMembersQueryKey(orgId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update organization");
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(org?.name || "");
  const [editSlug, setEditSlug] = useState(org?.slug || "");

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
    <div className="space-y-6">
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
              <Button asChild variant="outline" size="sm">
                <Link to="/organizations">back to organizations</Link>
              </Button>
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditName(org.name);
                    setEditSlug(org.slug);
                    setIsEditing(true);
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  edit
                </Button>
              )}
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

      {isEditing && isOwner && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="font-medium">Edit Organization</div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Organization name"
              />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">@</span>
                <Input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                  placeholder="slug"
                  pattern="[a-z0-9-]+"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => updateOrgMutation.mutate({ name: editName, slug: editSlug })}
                disabled={updateOrgMutation.isPending || !editName || !editSlug}
                size="sm"
              >
                {updateOrgMutation.isPending ? "saving..." : "save"}
              </Button>
              <Button onClick={() => setIsEditing(false)} variant="outline" size="sm">
                cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-1.5" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="h-4 w-4 mr-1.5" />
            Invitations ({invitations.length})
          </TabsTrigger>
          <TabsTrigger value="apikeys">
            <Key className="h-4 w-4 mr-1.5" />
            API Keys ({apiKeys.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6 pt-4">
          {members.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  canManage={canManageMembers && member.userId !== session?.user?.id}
                  onRemove={() => removeMemberMutation.mutate(member.id)}
                  isRemoving={removeMemberMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <EmptyCard label="No members found" />
          )}
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6 pt-4">
          {canManageMembers && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="font-medium">Invite member</div>
                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
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

          {invitations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {invitations.map((invitation) => (
                <InvitationCard
                  key={invitation.id}
                  invitation={invitation}
                  onCancel={
                    canManageMembers
                      ? () => cancelInvitationMutation.mutate(invitation.id)
                      : undefined
                  }
                  onResend={
                    canManageMembers
                      ? () => resendInvitationMutation.mutate(invitation.id)
                      : undefined
                  }
                  isCancelling={cancelInvitationMutation.isPending}
                  isResending={resendInvitationMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <EmptyCard label="No pending invitations" />
          )}
        </TabsContent>

        <TabsContent value="apikeys" className="space-y-6 pt-4">
          {canManageMembers && (
            <Card>
              <CardContent className="p-6">
                <ApiKeyForm
                  orgId={orgId}
                  onCreate={(name, permissions) =>
                    createApiKeyMutation.mutate({ name, permissions })
                  }
                  isPending={createApiKeyMutation.isPending}
                />
              </CardContent>
            </Card>
          )}

          {createdApiKey && (
            <ApiKeyReveal apiKey={createdApiKey} onDismiss={() => setCreatedApiKey(null)} />
          )}

          {apiKeys.length > 0 ? (
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
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleCopyApiKey(key.start || "", "Key copied")}
                        variant="outline"
                        size="sm"
                      >
                        copy
                      </Button>
                      {canManageMembers && (
                        <Button
                          onClick={() => deleteApiKeyMutation.mutate(key.id)}
                          disabled={deleteApiKeyMutation.isPending}
                          variant="outline"
                          size="sm"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          delete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyCard label="No API keys" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight break-all">{value}</div>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}
