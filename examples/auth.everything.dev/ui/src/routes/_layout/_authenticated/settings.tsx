import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { type SessionData, sessionQueryOptions, useAuthClient } from "@/app";
import { Button, Card, CardContent } from "@/components";
import { useUserPasskeys } from "@/components/settings-sections";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_layout/_authenticated/settings")({
  head: () => ({
    title: "Settings | auth.everything.dev",
    meta: [
      {
        name: "description",
        content: "Manage your account identity and security.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const auth = useAuthClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions(auth));
  const user = session?.user;
  const { data: passkeys = [] } = useUserPasskeys(!!user);
  const nearAccountId = auth.near.getAccountId();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage identity and session security.</p>
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

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Identity
        </h2>
        <IdentityTab user={user} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Security
        </h2>
        <SecurityTab user={user} />
      </section>
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
