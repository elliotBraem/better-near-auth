import { createFileRoute } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/app";
import {
  AccountLinkingCard,
  SubAccountAvailabilityCard,
  SubAccountCreationCard,
  useNearAccountsData,
  useSessionData,
} from "@/components/demo-sections";

export const Route = createFileRoute("/_layout/_authenticated/accounts")({
  head: () => ({
    title: "Accounts | auth.everything.dev",
    meta: [{ name: "description", content: "Manage linked NEAR and OAuth accounts." }],
  }),
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    if (session?.user) {
      await context.queryClient.ensureQueryData({
        queryKey: ["near-accounts"],
        queryFn: async () => {
          const res = await context.authClient.near.listAccounts();
          const accounts = res?.data?.accounts;
          return { accounts: Array.isArray(accounts) ? accounts : [] };
        },
        staleTime: 30_000,
      });
    }
  },
  component: AccountsPage,
});

function AccountsPage() {
  const { data: session } = useSessionData();
  const user = session?.user ?? null;
  const { data: nearAccountsData = { accounts: [] } } = useNearAccountsData(!!session?.user);
  const linkedAccounts = nearAccountsData.accounts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Link providers and switch your active NEAR account.
        </p>
      </div>

      <AccountLinkingCard linkedAccounts={linkedAccounts} user={user} />
      <SubAccountAvailabilityCard />
      <SubAccountCreationCard />
    </div>
  );
}
