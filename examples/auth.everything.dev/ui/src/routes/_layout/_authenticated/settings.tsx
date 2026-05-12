import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  type ApiClient,
  type Passkey,
  type SessionData,
  sessionQueryOptions,
  useApiClient,
  useAuthClient,
} from "@/app";
import {
  ApiKeyForm,
  type ApiKeyFormValues,
  ApiKeyReveal,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components";
import { Input } from "@/components/ui/input";

type CreatedApiKey = Awaited<ReturnType<ApiClient["auth"]["createApiKey"]>>;
type VerifyApiKeyResult = Awaited<ReturnType<ApiClient["auth"]["verifyApiKey"]>>;

export const Route = createFileRoute("/_layout/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings | app" },
      {
        name: "description",
        content: "Manage your account and authentication methods.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const auth = useAuthClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions(auth));
  const user = session?.user;
  const passkeyQueryKey = ["passkeys", user?.id] as const;
  const { data: passkeys = [] } = useQuery({
    queryKey: passkeyQueryKey,
    queryFn: async () => {
      const { data } = await auth.passkey.listUserPasskeys();
      return (data || []) as Passkey[];
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const nearAccountId = auth.near.getAccountId();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your identity, authentication methods, and security.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/home">back to workspace</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="email" value={user.email ? "linked" : "missing"} />
        <MiniStat label="near" value={nearAccountId ? "linked" : "missing"} />
        <MiniStat label="passkeys" value={String(passkeys.length)} />
        <MiniStat label="profile" value={user.isAnonymous ? "temporary" : "persistent"} />
      </div>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="auth">Auth Methods</TabsTrigger>
          <TabsTrigger value="apikeys">API Keys</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-6 pt-4">
          <IdentityTab user={user} />
        </TabsContent>

        <TabsContent value="auth" className="space-y-6 pt-4">
          <AuthMethodsTab user={user} passkeys={passkeys} nearAccountId={nearAccountId} />
        </TabsContent>

        <TabsContent value="apikeys" className="space-y-6 pt-4">
          <ApiKeysTab />
        </TabsContent>

        <TabsContent value="security" className="space-y-6 pt-4">
          <SecurityTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IdentityTab({
  user,
}: {
  user: { id: string; email?: string; name?: string; isAnonymous?: boolean | null };
}) {
  const auth = useAuthClient();
  const [name, setName] = useState(user.name || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.updateUser({ name });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Profile updated"),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <Field label="user id">
            <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 p-3 font-mono text-xs break-all">
              {user.id}
            </div>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="email">
              <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 p-3 text-sm text-muted-foreground">
                {user.email ?? "not linked"}
              </div>
            </Field>
            <Field label="account type">
              <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 p-3 text-sm text-muted-foreground">
                {user.isAnonymous ? "anonymous" : "standard"}
              </div>
            </Field>
          </div>
          <Field label="display name">
            <Input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your display name"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || name === (user.name || "")}
              variant="outline"
              size="sm"
            >
              {updateMutation.isPending ? "saving..." : "save profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {user.isAnonymous && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground leading-relaxed">
            This session is temporary. Link an email or NEAR wallet before signing out if you want
            the account to remain recoverable.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AuthMethodsTab({
  user,
  passkeys,
  nearAccountId,
}: {
  user: { id: string; email?: string; isAnonymous?: boolean | null };
  passkeys: Array<{ id: string; name?: string }>;
  nearAccountId: string | null;
}) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const [passkeyName, setPasskeyName] = useState("");
  const [passkeyToDelete, setPasskeyToDelete] = useState<{ id: string; name?: string } | null>(
    null,
  );
  const passkeyQueryKey = ["passkeys", user.id] as const;

  const addPasskeyMutation = useMutation({
    mutationFn: async () => {
      const name = passkeyName.trim();
      const { error } = name
        ? await auth.passkey.addPasskey({ name })
        : await auth.passkey.addPasskey();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPasskeyName("");
      toast.success("Passkey added");
      queryClient.invalidateQueries({ queryKey: passkeyQueryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removePasskeyMutation = useMutation({
    mutationFn: async (passkeyId: string) => {
      const { error } = await auth.passkey.deletePasskey({ id: passkeyId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPasskeyToDelete(null);
      toast.success("Passkey removed");
      queryClient.invalidateQueries({ queryKey: passkeyQueryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkNearMutation = useMutation({
    mutationFn: async () => {
      await auth.signIn.near();
    },
    onSuccess: () => toast.success("NEAR wallet linked"),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <MethodCard title="email" status={user.email ? "linked" : "missing"}>
          <p className="text-sm text-muted-foreground">
            {user.email ?? "Email login has not been linked for this account yet."}
          </p>
        </MethodCard>

        <MethodCard title="near" status={nearAccountId ? "linked" : "missing"}>
          {nearAccountId ? (
            <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 p-3 font-mono text-xs break-all">
              {nearAccountId}
            </div>
          ) : (
            <Button
              onClick={() => linkNearMutation.mutate()}
              disabled={linkNearMutation.isPending}
              variant="outline"
              size="sm"
            >
              {linkNearMutation.isPending ? "linking..." : "link NEAR wallet"}
            </Button>
          )}
        </MethodCard>

        <MethodCard
          title="passkeys"
          status={passkeys.length > 0 ? `${passkeys.length} linked` : "missing"}
        >
          <div className="space-y-2">
            {passkeys.length > 0 ? (
              passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 p-3 flex items-center justify-between gap-3"
                >
                  <span className="text-sm truncate">{passkey.name || "Passkey"}</span>
                  <Button
                    onClick={() => setPasskeyToDelete(passkey)}
                    disabled={removePasskeyMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    remove
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
            )}
            <Input
              type="text"
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              placeholder="Passkey name, e.g. Work laptop"
            />
            <Button
              onClick={() => addPasskeyMutation.mutate()}
              disabled={addPasskeyMutation.isPending}
              variant="outline"
              size="sm"
            >
              {addPasskeyMutation.isPending ? "adding..." : "add passkey"}
            </Button>
          </div>
        </MethodCard>
      </div>
      <ConfirmDialog
        open={!!passkeyToDelete}
        onOpenChange={(open) => {
          if (!open) setPasskeyToDelete(null);
        }}
        title="Remove passkey"
        description={`Remove ${passkeyToDelete?.name || "this passkey"} from your account? You will no longer be able to use it to sign in.`}
        confirmLabel="remove"
        variant="destructive"
        onConfirm={() => {
          if (passkeyToDelete) {
            removePasskeyMutation.mutate(passkeyToDelete.id);
          }
        }}
        isPending={removePasskeyMutation.isPending}
      />
    </>
  );
}

function ApiKeysTab() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [createdApiKey, setCreatedApiKey] = useState<CreatedApiKey | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ title: "", description: "", onConfirm: () => {} });

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["user-api-keys"],
    queryFn: () => apiClient.auth.listApiKeys({}),
  });

  const createMutation = useMutation({
    mutationFn: (values: ApiKeyFormValues) => apiClient.auth.createApiKey(values),
    onSuccess: (data) => {
      setCreatedApiKey(data);
      toast.success("API key created");
      queryClient.invalidateQueries({ queryKey: ["user-api-keys"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create API key"),
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.auth.updateApiKey({ id, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-api-keys"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update API key"),
  });

  const deleteMutation = useMutation({
    mutationFn: (keyId: string) => apiClient.auth.deleteApiKey({ id: keyId }),
    onSuccess: () => {
      toast.success("API key deleted");
      queryClient.invalidateQueries({ queryKey: ["user-api-keys"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete API key"),
  });

  const handleDelete = (keyId: string, keyName: string | null) => {
    setConfirmConfig({
      title: "Delete API key",
      description: `Permanently revoke ${keyName ?? "this key"}. Any service using it will stop working.`,
      onConfirm: () => {
        deleteMutation.mutate(keyId);
        setConfirmOpen(false);
      },
    });
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <ApiKeyForm
            onCreate={(values) => createMutation.mutate(values)}
            isPending={createMutation.isPending}
          />
        </CardContent>
      </Card>

      {createdApiKey && (
        <ApiKeyReveal apiKey={createdApiKey} onDismiss={() => setCreatedApiKey(null)} />
      )}

      <VerifyApiKeyCard />

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading API keys...
          </CardContent>
        </Card>
      ) : apiKeys.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {apiKeys.map((key) => {
            const perms = key.permissions as Record<string, string[]> | null;
            const permEntries = perms ? Object.entries(perms) : [];
            return (
              <Card key={key.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium break-all">{key.name ?? "unnamed"}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {key.prefix ?? "api_"}...{key.start ?? ""}
                      </div>
                    </div>
                    <Badge variant="outline">{key.enabled ? "enabled" : "disabled"}</Badge>
                  </div>
                  {permEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {permEntries.flatMap(([scope, actions]) =>
                        actions.map((action) => (
                          <Badge
                            key={`${scope}:${action}`}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {scope}:{action}
                          </Badge>
                        )),
                      )}
                    </div>
                  )}
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <div>created {new Date(key.createdAt).toLocaleString()}</div>
                    {key.expiresAt && <div>expires {new Date(key.expiresAt).toLocaleString()}</div>}
                    {key.lastRequest && (
                      <div>last used {new Date(key.lastRequest).toLocaleString()}</div>
                    )}
                    {key.rateLimitEnabled && key.rateLimitMax && key.rateLimitTimeWindow && (
                      <div>
                        rate limit {key.rateLimitMax}/{key.rateLimitTimeWindow}ms
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        toggleEnabledMutation.mutate({ id: key.id, enabled: !key.enabled })
                      }
                      disabled={toggleEnabledMutation.isPending}
                      variant="outline"
                      size="sm"
                    >
                      {key.enabled ? "disable" : "enable"}
                    </Button>
                    <Button
                      onClick={() => handleDelete(key.id, key.name)}
                      disabled={deleteMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No personal API keys
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmConfig.title}
        description={confirmConfig.description}
        variant="destructive"
        onConfirm={confirmConfig.onConfirm}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function VerifyApiKeyCard() {
  const apiClient = useApiClient();
  const [verifyInput, setVerifyInput] = useState("");
  const [result, setResult] = useState<VerifyApiKeyResult | null>(null);

  const verifyMutation = useMutation({
    mutationFn: (key: string) => apiClient.auth.verifyApiKey({ key }),
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => toast.error(error.message || "Failed to verify API key"),
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <div className="space-y-1">
          <div className="font-medium">Verify a key</div>
          <p className="text-sm text-muted-foreground">
            Paste a key value to check if it is valid. Verification does not require a session.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="text"
            value={verifyInput}
            onChange={(event) => setVerifyInput(event.target.value)}
            placeholder="api_..."
            className="font-mono text-xs"
          />
          <Button
            onClick={() => verifyMutation.mutate(verifyInput.trim())}
            disabled={verifyMutation.isPending || !verifyInput.trim()}
            variant="outline"
            size="sm"
          >
            {verifyMutation.isPending ? "verifying..." : "verify"}
          </Button>
        </div>
        {result && (
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{result.valid ? "valid" : "invalid"}</Badge>
              {result.error && (
                <span className="text-muted-foreground">
                  {result.error.code}
                  {result.error.message ? `: ${result.error.message}` : ""}
                </span>
              )}
            </div>
            {result.key && (
              <div className="text-muted-foreground">
                Matches key <span className="font-mono">{result.key.name ?? result.key.id}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SecurityTab({ user }: { user: { email?: string; isAnonymous?: boolean | null } }) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      return (async () => {
        const { error } = await auth.changePassword({
          currentPassword,
          newPassword,
        });
        if (error) throw new Error(error.message);
      })();
    },
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.revokeSessions();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Other sessions revoked"),
    onError: (err: Error) => toast.error(err.message),
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.signOut();
      if (error) {
        throw new Error(error.message || "Failed to sign out");
      }
      await auth.near.disconnect().catch(() => {});
    },
    onSuccess: async () => {
      queryClient.setQueryData(["session"], null);
      queryClient.removeQueries({ queryKey: ["passkeys"] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate({ to: "/", replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      {user.email ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="font-medium">Change password</div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="current password">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Current password"
                />
              </Field>
              <Field label="new password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                />
              </Field>
              <Field label="confirm password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm password"
                />
              </Field>
            </div>
            <Button
              onClick={() => changePasswordMutation.mutate()}
              disabled={
                changePasswordMutation.isPending ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              variant="outline"
              size="sm"
            >
              {changePasswordMutation.isPending ? "changing..." : "change password"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Password management appears once an email-based login is attached to this account.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        <SecurityActionCard
          title="revoke other sessions"
          body="End every other active session while keeping this one open."
          actionLabel={revokeSessionsMutation.isPending ? "revoking..." : "revoke sessions"}
          onClick={() => revokeSessionsMutation.mutate()}
          disabled={revokeSessionsMutation.isPending}
        />
        <SecurityActionCard
          title="sign out"
          body="Disconnect this session and return to the public landing page."
          actionLabel={signOutMutation.isPending ? "signing out..." : "sign out"}
          onClick={() => signOutMutation.mutate()}
          disabled={signOutMutation.isPending}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function MethodCard({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">{title}</div>
          <Badge variant="outline">{status}</Badge>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SecurityActionCard({
  title,
  body,
  actionLabel,
  onClick,
  disabled,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="space-y-1">
          <div className="font-medium">{title}</div>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
        <Button onClick={onClick} disabled={disabled} variant="outline" size="sm">
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
