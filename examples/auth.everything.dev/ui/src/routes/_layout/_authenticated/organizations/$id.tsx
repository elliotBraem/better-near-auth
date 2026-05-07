import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getAuthClient, type Organization, type SessionData } from "@/app";
import { Badge, Button, Card, CardContent, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components";
import { useApiClient } from "@/lib/use-api-client";
import { NearProfile } from "@/components/near-profile";

const USER_AGENT = typeof navigator !== "undefined" ? navigator.userAgent : "";
const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(USER_AGENT);

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

  // NEAR account search state
  const [nearSearchId, setNearSearchId] = useState("");
  const [nearProfileData, setNearProfileData] = useState<any>(null);
  const [nearProfileLoading, setNearProfileLoading] = useState(false);

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

  const resendInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => apiClient.auth.resendInvitation({ id: invitationId }),
    onSuccess: async () => {
      toast.success("Invitation resent");
      await queryClient.invalidateQueries({ queryKey: ["org-invitations", orgId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resend invitation");
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

  const handleSearchNearProfile = async () => {
    if (!nearSearchId.trim()) return;
    setNearProfileLoading(true);
    try {
      const res = await apiClient.auth.nearProfile({ accountId: nearSearchId.trim() });
      setNearProfileData(res || null);
    } catch {
      setNearProfileData(null);
    } finally {
      setNearProfileLoading(false);
    }
  };

  const handleInviteFromNear = () => {
    if (nearProfileData?.name || nearSearchId) {
      const email = nearSearchId.includes("@") ? nearSearchId : `${nearSearchId.replace(/\./g, "")}@near.email`;
      setInviteEmail(email);
      setShowInviteForm(true);
      toast.info(`Prepared invitation for ${nearSearchId}. Adjust the email if needed and send.`);
    }
  };

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

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="invitations">Invitations ({invitations.length})</TabsTrigger>
          <TabsTrigger value="apikeys">API Keys ({apiKeys.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6 pt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="font-medium">Find by NEAR Account</div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. josh.near"
                  value={nearSearchId}
                  onChange={(e) => {
                    setNearSearchId(e.target.value);
                    setNearProfileData(null);
                  }}
                  className="flex-1"
                />
                <Button onClick={handleSearchNearProfile} disabled={nearProfileLoading || !nearSearchId.trim()}>
                  {nearProfileLoading ? "Loading..." : "Search"}
                </Button>
              </div>

              {nearProfileData && (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <NearProfile accountId={nearSearchId} variant="card" showAvatar showName />
                  <div className="flex gap-2">
                    <Button onClick={handleInviteFromNear} variant="outline" size="sm">
                      Invite to Organization
                    </Button>
                    <Button onClick={() => { setNearSearchId(""); setNearProfileData(null); }} variant="ghost" size="sm">
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              {!nearProfileLoading && nearSearchId && !nearProfileData && (
                <p className="text-sm text-muted-foreground">No NEAR Social profile found for this account.</p>
              )}
            </CardContent>
          </Card>

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
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => inviteMutation.mutate()}
                    disabled={inviteMutation.isPending || !inviteEmail}
                    variant="outline"
                    size="sm"
                  >
                    {inviteMutation.isPending ? "sending..." : "send invitation"}
                  </Button>
                  <Button onClick={() => setShowInviteForm(false)} variant="ghost" size="sm">
                    cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!showInviteForm && (
            <Button onClick={() => setShowInviteForm(true)} variant="outline" size="sm">
              Invite by Email
            </Button>
          )}

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
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6 pt-4">
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
                      <div className="flex gap-1">
                        <Button
                          onClick={() => resendInvitationMutation.mutate(invitation.id)}
                          disabled={resendInvitationMutation.isPending}
                          variant="outline"
                          size="sm"
                        >
                          resend
                        </Button>
                        <Button
                          onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                          disabled={cancelInvitationMutation.isPending}
                          variant="outline"
                          size="sm"
                        >
                          cancel
                        </Button>
                      </div>
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
        </TabsContent>

        <TabsContent value="apikeys" className="space-y-6 pt-4">
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
                <div className="flex gap-2">
                  <Button
                    onClick={() => createApiKeyMutation.mutate()}
                    disabled={createApiKeyMutation.isPending || !apiKeyName}
                    variant="outline"
                    size="sm"
                  >
                    {createApiKeyMutation.isPending ? "creating..." : "create key"}
                  </Button>
                  <Button onClick={() => setShowApiKeyForm(false)} variant="ghost" size="sm">
                    cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!showApiKeyForm && (
            <Button onClick={() => setShowApiKeyForm(true)} variant="outline" size="sm">
              New API Key
            </Button>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight break-all">{value}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 grid gap-1 sm:grid-cols-[100px_1fr] sm:gap-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "text-xs font-mono break-all" : "text-sm break-all"}>{value}</div>
    </div>
  );
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
