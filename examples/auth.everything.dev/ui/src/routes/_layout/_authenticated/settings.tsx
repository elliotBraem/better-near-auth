import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getAuthClient, type Passkey, type SessionData } from "@/app";
import { Badge, Button, Card, CardContent, UnderConstruction } from "@/components";
import { sessionQueryOptions } from "@/lib/session";

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
  const auth = getAuthClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions());
  const { data: passkeys = [] } = useQuery({
    queryKey: ["passkeys"],
    queryFn: async () => {
      const { data } = await getAuthClient().passkey.listUserPasskeys();
      return (data || []) as Passkey[];
    },
    staleTime: 60 * 1000,
  });

  const user = session?.user;
  const nearAccountId = auth.near.getAccountId();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">settings</Badge>
              {user.isAnonymous && <Badge variant="outline">anonymous</Badge>}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Identity & Security
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Update your profile, attach durable authentication methods, and control how your
                workspace session behaves.
              </p>
              <UnderConstruction
                label="settings"
                sourceFile="ui/src/routes/_layout/_authenticated/settings.tsx"
                className="w-full max-w-sm mt-3"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/home">back to workspace</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/apps" search={{}}>
                  published apps
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <MiniStat label="email" value={user.email ? "linked" : "missing"} />
            <MiniStat label="near" value={nearAccountId ? "linked" : "missing"} />
            <MiniStat label="passkeys" value={String(passkeys.length)} />
            <MiniStat label="profile" value={user.isAnonymous ? "temporary" : "persistent"} />
          </CardContent>
        </Card>
      </section>

      <ProfileSection user={user} />
      <AuthMethodsSection user={user} passkeys={passkeys} nearAccountId={nearAccountId} />
      <SecuritySection user={user} />
    </div>
  );
}

function ProfileSection({
  user,
}: {
  user: { id: string; email?: string; name?: string; isAnonymous?: boolean | null };
}) {
  const [name, setName] = useState(user.name || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await getAuthClient().updateUser({ name });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Profile updated"),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Core identity values stored on your account session.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <Field label="user id">
            <div className="rounded-sm border border-border bg-muted/10 p-3 font-mono text-xs break-all">
              {user.id}
            </div>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="email">
              <div className="rounded-sm border border-border bg-muted/10 p-3 text-sm text-muted-foreground">
                {user.email ?? "not linked"}
              </div>
            </Field>
            <Field label="account type">
              <div className="rounded-sm border border-border bg-muted/10 p-3 text-sm text-muted-foreground">
                {user.isAnonymous ? "anonymous" : "standard"}
              </div>
            </Field>
          </div>
          <Field label="display name">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="flex h-10 w-full border-2 border-inset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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
    </section>
  );
}

function AuthMethodsSection({
  user,
  passkeys,
  nearAccountId,
}: {
  user: { email?: string; isAnonymous?: boolean | null };
  passkeys: Array<{ id: string; name?: string }>;
  nearAccountId: string | null;
}) {
  const addPasskeyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await getAuthClient().passkey.addPasskey();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Passkey added"),
    onError: (err: Error) => toast.error(err.message),
  });

  const removePasskeyMutation = useMutation({
    mutationFn: async (passkeyId: string) => {
      const { error } = await getAuthClient().passkey.deletePasskey({ id: passkeyId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Passkey removed"),
    onError: (err: Error) => toast.error(err.message),
  });

  const linkNearMutation = useMutation({
    mutationFn: async () => {
      await getAuthClient().signIn.near();
    },
    onSuccess: () => toast.success("NEAR wallet linked"),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Auth Methods</h2>
        <p className="text-sm text-muted-foreground">
          Attach stronger login methods and keep your account portable.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MethodCard title="email" status={user.email ? "linked" : "missing"}>
          <p className="text-sm text-muted-foreground">
            {user.email ?? "Email login has not been linked for this account yet."}
          </p>
        </MethodCard>

        <MethodCard title="near" status={nearAccountId ? "linked" : "missing"}>
          {nearAccountId ? (
            <div className="rounded-sm border border-border bg-muted/10 p-3 font-mono text-xs break-all">
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
                  className="rounded-sm border border-border bg-muted/10 p-3 flex items-center justify-between gap-3"
                >
                  <span className="text-sm truncate">{passkey.name || "Passkey"}</span>
                  <Button
                    onClick={() => removePasskeyMutation.mutate(passkey.id)}
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
    </section>
  );
}

function SecuritySection({ user }: { user: { email?: string; isAnonymous?: boolean | null } }) {
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
        const { error } = await getAuthClient().changePassword({ currentPassword, newPassword });
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
      const { error } = await getAuthClient().revokeSessions();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Other sessions revoked"),
    onError: (err: Error) => toast.error(err.message),
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await getAuthClient().signOut();
      await getAuthClient()
        .near.disconnect()
        .catch(() => {});
    },
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Security</h2>
        <p className="text-sm text-muted-foreground">
          Session controls and password management for linked email accounts.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {user.email ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="font-medium">Change password</div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="current password">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="flex h-10 w-full border-2 border-inset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
                <Field label="new password">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="flex h-10 w-full border-2 border-inset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
                <Field label="confirm password">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="flex h-10 w-full border-2 border-inset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted/10 p-3 space-y-1">
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
