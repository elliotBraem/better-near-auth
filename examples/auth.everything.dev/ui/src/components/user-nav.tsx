import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { getAuthClient, type Organization } from "@/app";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionQueryOptions } from "@/lib/session";

export function UserNav() {
  const auth = getAuthClient();
  const { data: session } = useQuery(sessionQueryOptions());
  const user = session?.user;
  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data } = await auth.organization.list();
      return (data || []) as Organization[];
    },
    staleTime: 30 * 1000,
    enabled: !!user,
  });
  const activeOrgId = session?.session?.activeOrganizationId;

  const activeOrg = useMemo(() => {
    return organizations?.find((org) => org.id === activeOrgId);
  }, [organizations, activeOrgId]);

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await auth.signOut();
      await auth.near.disconnect().catch(() => {});
    },
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.location.assign("/");
      }
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

  return (
    <div className="flex items-center gap-2">
      {activeOrg && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden sm:flex max-w-[120px] text-xs text-muted-foreground"
        >
          <Link to="/home">
            <span className="truncate">{activeOrg.name}</span>
          </Link>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="w-6 h-6 rounded-full bg-foreground transition-all duration-200 ease-out hover:shadow-lg hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            title="menu"
          />
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

function DotControl() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-6 h-6 rounded-full bg-foreground transition-all duration-200 ease-out hover:shadow-lg hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          title="actions"
        />
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
