import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { getAuthClient, type Organization, type Passkey, type SessionData } from "@/app";
import { Badge, Button, Card, CardContent, UnderConstruction } from "@/components";
import { sessionQueryOptions } from "@/lib/session";

export const Route = createFileRoute("/_layout/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Workspace | app" },
      { name: "description", content: "Your workspace center." },
    ],
  }),
  component: Home,
});

function Home() {
  const auth = getAuthClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions());
  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data } = await auth.organization.list();
      return (data || []) as Organization[];
    },
    staleTime: 30 * 1000,
  });
  const { data: passkeys = [] } = useQuery({
    queryKey: ["passkeys"],
    queryFn: async () => {
      const { data } = await auth.passkey.listUserPasskeys();
      return (data || []) as Passkey[];
    },
    staleTime: 60 * 1000,
  });
  const user = session?.user;

  const activeOrgId = session?.session?.activeOrganizationId;
  const nearAccountId = auth.near.getAccountId();

  const activeOrg = useMemo(
    () =>
      activeOrgId && organizations.length
        ? (organizations.find((org) => org.id === activeOrgId) ?? null)
        : null,
    [organizations, activeOrgId],
  );

  const profile = useMemo(() => {
    if (!user) {
      return {
        isAnonymous: false,
        hasEmail: false,
        hasNear: false,
        hasPasskeys: false,
        isAdmin: false,
      };
    }

    return {
      isAnonymous: user.isAnonymous || false,
      hasEmail: Boolean(user.email),
      hasNear: Boolean(nearAccountId),
      hasPasskeys: passkeys.length > 0,
      isAdmin: user.role === "admin",
    };
  }, [user, nearAccountId, passkeys.length]);

  if (!user) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Loading workspace...
        </CardContent>
      </Card>
    );
  }

  const capabilityCount = [profile.hasEmail, profile.hasNear, profile.hasPasskeys].filter(
    Boolean,
  ).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">workspace</Badge>
              {profile.isAnonymous && <Badge variant="outline">anonymous</Badge>}
              {profile.isAdmin && <Badge variant="outline">admin</Badge>}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                {user.name || user.email || user.id.slice(0, 8)}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Manage identity and settings.
              </p>
              <UnderConstruction
                label="home"
                sourceFile="ui/src/routes/_layout/_authenticated/home.tsx"
                className="w-full max-w-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/settings">identity settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatBox label="organizations" value={String(organizations.length)} />
            <StatBox label="linked methods" value={String(capabilityCount)} />
            <StatBox label="passkeys" value={String(passkeys.length)} />
            <StatBox label="active org" value={activeOrg ? "yes" : "no"} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              identity status
            </div>
            <div className="grid gap-3">
              <InfoRow
                label="email"
                value={profile.hasEmail ? (user.email ?? "linked") : "not linked"}
              />
              <InfoRow
                label="near"
                value={profile.hasNear ? (nearAccountId ?? "linked") : "not linked"}
                mono
              />
              <InfoRow
                label="passkeys"
                value={profile.hasPasskeys ? `${passkeys.length} registered` : "not linked"}
              />
              <InfoRow
                label="profile"
                value={profile.isAnonymous ? "anonymous session" : "persistent account"}
              />
            </div>
            {profile.isAnonymous && (
              <div className="rounded-sm border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                Link an email or NEAR wallet before signing out so your progress stays attached to a
                durable identity.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">navigator</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <WorkspaceTile
                title="settings"
                body="profile, linked auth methods, sessions, and sign out"
                to="/settings"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {activeOrg && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Active Organization</h2>
            <p className="text-sm text-muted-foreground">
              The current workspace target for organization-scoped actions.
            </p>
          </div>

          <Card>
            <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                {activeOrg.logo ? (
                  <img
                    src={activeOrg.logo}
                    alt=""
                    className="w-12 h-12 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] flex items-center justify-center text-lg">
                    {activeOrg.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium break-all">{activeOrg.name}</div>
                    {(activeOrg.slug === user.id || activeOrg.metadata?.isPersonal === true) && (
                      <Badge variant="outline">personal</Badge>
                    )}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">@{activeOrg.slug}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-muted/10 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
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

function WorkspaceTile({ title, body, to }: { title: string; body: string; to?: "/settings" }) {
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

  return tile;
}
