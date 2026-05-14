import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type SessionData, sessionQueryOptions, useAuthClient } from "@/app";
import { AuthMethodsPanel, useUserPasskeys } from "@/components/settings-sections";

export const Route = createFileRoute("/_layout/_authenticated/auth-methods")({
  head: () => ({
    title: "Auth Methods | auth.everything.dev",
    meta: [
      { name: "description", content: "Manage linked authentication methods." },
    ],
  }),
  component: AuthMethodsPage,
});

function AuthMethodsPage() {
  const auth = useAuthClient();
  const sessionQuery = useQuery<SessionData | null>(sessionQueryOptions(auth));
  const { data: session } = sessionQuery;
  const user = session?.user;
  const passkeysQuery = useUserPasskeys(!!user);
  const passkeys = passkeysQuery.data ?? [];
  const nearAccountId = auth.near.getAccountId();

  if (sessionQuery.isLoading || passkeysQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auth Methods</h1>
          <p className="text-sm text-muted-foreground">Loading linked authentication methods...</p>
        </div>
      </div>
    );
  }

  if (sessionQuery.error || passkeysQuery.error) {
    const error = sessionQuery.error || passkeysQuery.error;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auth Methods</h1>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Failed to load authentication methods."}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auth Methods</h1>
        <p className="text-sm text-muted-foreground">
          Manage linked credentials and sign-in methods for this user.
        </p>
      </div>

      <AuthMethodsPanel user={user} passkeys={passkeys} nearAccountId={nearAccountId} />
    </div>
  );
}
