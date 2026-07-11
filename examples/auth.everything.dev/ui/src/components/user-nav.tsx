import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { forwardRef, useCallback } from "react";
import type { AuthClient, Organization } from "@/app";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { Button, OrgSwitcher } from "@/components";
import { sessionQueryKey } from "@/lib/auth";

const organizationsQueryKey = ["organizations"] as const;

function organizationsQueryOptions(authClient: AuthClient, enabled: boolean) {
  return {
    queryKey: organizationsQueryKey,
    queryFn: async (): Promise<Organization[]> => {
      const { data } = await authClient.organization.list();
      return (data ?? []) as Organization[];
    },
    enabled,
  };
}

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserNav() {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const user = session?.user;
  const { data: organizations } = useQuery(organizationsQueryOptions(auth, !!user));
  const activeOrgId = session?.session?.activeOrganizationId;

  const activeOrg = organizations?.find((org) => org.id === activeOrgId);

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.signOut();
      if (error) {
        throw new Error(error.message || "Failed to sign out");
      }
      await auth.near.disconnect().catch(() => {});
    },
    onSuccess: async () => {
      queryClient.setQueryData(sessionQueryKey, null);
      queryClient.removeQueries({ queryKey: organizationsQueryKey });
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      await router.invalidate();
      await navigate({ to: "/", replace: true });
    },
    onError: (error: Error) => {
      console.error("Sign out error:", error);
    },
  });

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/login">connect</Link>
        </Button>
        <DotControl />
      </div>
    );
  }

  const handleOrgSwitch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    await queryClient.invalidateQueries({ queryKey: organizationsQueryKey });
  }, [queryClient]);

  const organizationsList = organizations ?? [];

  return (
    <div className="flex items-center gap-2">
      {organizationsList.length > 0 && (
        <OrgSwitcher
          organizations={organizationsList}
          activeOrgId={activeOrgId}
          onSwitch={handleOrgSwitch}
        />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuButton title="menu" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">signed in as</p>
              <p className="truncate text-sm font-normal">{user.email || user.id}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/home">workspace</Link>
          </DropdownMenuItem>
          {activeOrg && (
            <DropdownMenuItem asChild>
              <Link to="/organizations/$slug" params={{ slug: activeOrg.slug }}>
                {activeOrg.name}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/settings">settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              signOutMutation.mutate();
            }}
            disabled={signOutMutation.isPending}
          >
            {signOutMutation.isPending ? "signing out..." : "sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const MenuButton = forwardRef<HTMLButtonElement, { title: string }>(({ title, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className="w-6 h-6 rounded-full bg-foreground transition-all duration-200 ease-out hover:shadow-lg hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    title={title}
    {...props}
  />
));

function DotControl() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuButton title="actions" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">navigate</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/login">connect</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
