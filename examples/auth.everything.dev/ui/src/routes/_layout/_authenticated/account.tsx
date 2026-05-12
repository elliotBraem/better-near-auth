import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { NearProfileSearchCard } from "@/components/demo-sections";

export const Route = createFileRoute("/_layout/_authenticated/account")({
  head: () => ({
    title: "NEAR Profiles | auth.everything.dev",
    meta: [
      { name: "description", content: "Search NEAR Social profiles by account ID." },
    ],
  }),
  component: AccountSearchPage,
});

function AccountSearchPage() {
  const location = useLocation();

  if (location.pathname !== "/account") {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">NEAR Profiles</h1>
        <p className="text-sm text-muted-foreground">
          Search and inspect profile data returned through the SIWN profile endpoint.
        </p>
      </div>
      <NearProfileSearchCard />
    </div>
  );
}
