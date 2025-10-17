import { createFileRoute, notFound } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { NearProfile } from "@/components/near-profile";
import { Loader } from "lucide-react";

export const Route = createFileRoute("/_layout/$accountId")({
  loader: async ({ params }) => {
    try {
      const profile = await authClient.near.getProfile(params.accountId);

      if (!profile.data) {
        throw notFound();
      }

      return {
        profile: profile.data,
        accountId: params.accountId
      };
    } catch (error) {
      if ((error as any)?.code === "NOT_FOUND" || error instanceof Response && error.status === 404) {
        throw notFound();
      }
      throw error;
    }
  },
  component: ProfilePage,
  notFoundComponent: () => (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-muted-foreground mb-4">Profile Not Found</h1>
        <p className="text-muted-foreground">The requested NEAR account profile could not be found.</p>
      </div>
    </div>
  ),
  pendingComponent: () => (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-muted-foreground mb-4">Error Loading Profile</h1>
        <p className="text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      </div>
    </div>
  ),
});

function ProfilePage() {
  const { profile, accountId } = Route.useLoaderData();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <title>{profile?.name || accountId} - NEAR Profile</title>
      <meta name="description" content={`${profile?.name || accountId}'s NEAR Social profile`} />

      <NearProfile variant="card" accountId={accountId} showAvatar={true} showName={true} />
    </div>
  );
}
