import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { useNearAccounts } from "@/lib/auth-hooks";
import { Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { NearProfile } from "./near-profile";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { getNearAccountId } from "@/lib/auth-utils";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const { data: linkedAccounts } = useNearAccounts(session);

  const sessionNearAccountId = (session?.user as any)?.nearAccount?.accountId;
  const nearAccountId = sessionNearAccountId
    ? sessionNearAccountId.split(":")[0]
    : getNearAccountId(linkedAccounts ?? []);

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session || !session.user) {
    return (
      <Button variant="outline" asChild className="min-h-9 min-w-[80px]">
        <Link to="/login">Sign In</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2 min-h-9 touch-manipulation">
          <NearProfile variant="badge" accountId={nearAccountId || undefined} showAvatar={true} showName={true} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card w-56 mr-4">
        <DropdownMenuLabel className="py-3">My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="py-3 text-sm">{session?.user?.name ?? "User"}</DropdownMenuItem>
        {nearAccountId && (
          <DropdownMenuItem asChild>
            <Link to="/profile/$accountId" params={{ accountId: nearAccountId }} className="flex items-center gap-2 py-3">
              <ExternalLink className="h-4 w-4" />
              View Profile
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Button
            variant="destructive"
            className="w-full min-h-10 touch-manipulation my-2"
            onClick={async () => {
              try {
                await authClient.signOut({
                  fetchOptions: {
                    onSuccess: async () => {
                      await authClient.near.disconnect();
                      navigate({
                        to: "/",
                      });
                    },
                  },
                });
              } catch (error) {
                console.error("Sign out error:", error);
                navigate({
                  to: "/",
                });
              }
            }}
          >
            Sign Out
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
