import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components";
import { NearProfileSearchCard } from "@/components/demo-sections";

export const Route = createFileRoute("/_layout/_authenticated/account/$accountId")({
  head: ({ params }) => ({
    title: `${params.accountId} | auth.everything.dev`,
    meta: [{ name: "description", content: `NEAR profile for ${params.accountId}.` }],
  }),
  component: AccountProfilePage,
});

function AccountProfilePage() {
  const { accountId } = Route.useParams();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">NEAR Profile</h1>
          <p className="text-sm text-muted-foreground">{accountId}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/account">search profiles</Link>
        </Button>
      </div>
      <NearProfileSearchCard initialAccountId={accountId} />
    </div>
  );
}
