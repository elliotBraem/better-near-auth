import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthClient, type Organization, type SessionData } from "@/app";
import { sessionQueryOptions } from "@/lib/session";

interface AuthContext {
  isAuthenticated: boolean;
  user: SessionData["user"] | null;
  session: SessionData["session"] | null;
  activeOrganizationId: string | null;
  isAnonymous: boolean;
  isAdmin: boolean;
  isBanned: boolean;
}

export const Route = createFileRoute("/_layout/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const { queryClient } = context;
    const runtimeConfig = context.runtimeConfig;

    const session = await queryClient.ensureQueryData(
      sessionQueryOptions(context.session, runtimeConfig),
    );

    if (!session?.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }

    if (session.user.banned) {
      throw redirect({
        to: "/login",
        hash: "banned",
      });
    }

    const auth: AuthContext = {
      isAuthenticated: true,
      user: session.user,
      session: session.session,
      activeOrganizationId: session.session?.activeOrganizationId || null,
      isAnonymous: session.user.isAnonymous || false,
      isAdmin: session.user.role === "admin",
      isBanned: session.user.banned || false,
    };

    await queryClient.ensureQueryData({
      queryKey: ["organizations"],
      queryFn: async () => {
        const { data } = await getAuthClient(runtimeConfig).organization.list();
        return (data || []) as Organization[];
      },
      staleTime: 30 * 1000,
    });

    return {
      auth,
      session,
    };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
