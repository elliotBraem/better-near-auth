import { Link, createFileRoute } from "@tanstack/react-router";
import { Clock, Key, Link2, Search, ShieldCheck, UserRound, Zap } from "lucide-react";
import {
  getActiveNearAccountId,
  StatCard,
  useSessionData,
  useWorkspaceData,
} from "@/components/demo-sections";
import { Badge, Button, Card, CardContent } from "@/components";

export const Route = createFileRoute("/_layout/_authenticated/home")({
  head: () => ({
    title: "Workspace | auth.everything.dev",
    meta: [
      { name: "description", content: "Your authenticated demo workspace." },
    ],
  }),
  component: WorkspacePage,
});

const capabilityCards = [
  {
    icon: Link2,
    label: "accounts",
    title: "Account linking",
    body: "Link NEAR and OAuth providers, switch active NEAR accounts, and inspect session identity.",
    to: "/accounts" as const,
  },
  {
    icon: Zap,
    label: "relayer",
    title: "Guestbook signing",
    body: "Try gasless relayed transactions beside direct wallet signing.",
    to: "/guestbook" as const,
  },
  {
    icon: Search,
    label: "account",
    title: "Profile explorer",
    body: "Search NEAR Social profiles and open account-specific profile routes.",
    to: "/account" as const,
  },
  {
    icon: UserRound,
    label: "auth",
    title: "Auth methods",
    body: "Manage passkeys, NEAR, email, phone, and supported sign-in methods.",
    to: "/auth-methods" as const,
  },
  {
    icon: Key,
    label: "api",
    title: "API keys",
    body: "Create personal API keys and test key lifecycle management.",
    to: "/api-keys" as const,
  },
  {
    icon: ShieldCheck,
    label: "orgs",
    title: "Organizations",
    body: "Manage workspaces, members, invitations, and organization API keys.",
    to: "/organizations" as const,
  },
];

function WorkspacePage() {
  const { data: session } = useSessionData();
  const user = session?.user ?? null;
  const workspace = useWorkspaceData(session);
  const nearAccountId = getActiveNearAccountId({
    accounts: workspace.linkedAccounts,
    activeAccount: workspace.linkedAccounts.find((account) => account.isActive || account.isPrimary) ?? null,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.name || nearAccountId || "User"}. Choose a plugin capability to explore.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Linked Accounts" value={String(workspace.linkedAccounts.length)} icon={<Link2 className="h-4 w-4" />} />
        <StatCard label="Organizations" value={String(workspace.organizations.length)} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Relayer" value={workspace.relayerData?.enabled ? "Active" : "Inactive"} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Session" value={user ? "Valid" : "Expired"} icon={<Clock className="h-4 w-4" />} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Capabilities</h2>
          <Badge variant="outline">better-near-auth</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilityCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <Badge variant="outline">{item.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                  <Button asChild variant="outline" size="sm">
                    <Link to={item.to}>open</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
