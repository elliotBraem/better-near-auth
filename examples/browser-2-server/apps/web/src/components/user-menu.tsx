import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { NearProfile } from "./near-profile";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { useEffect, useState } from "react";
import { getNearAccountId } from "@/lib/auth-utils";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
   const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);

  // Fetch linked accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accountsResponse = await authClient.listAccounts();
        console.log("accountsResponse", accountsResponse);
        const accounts = accountsResponse?.data;
        setLinkedAccounts(Array.isArray(accounts) ? accounts : []);
      } catch (error) {
        console.error("Failed to fetch linked accounts:", error);
        setLinkedAccounts([]);
      }
    };

    if (session) {
      fetchAccounts();
    } else {
      setLinkedAccounts([]);
    }
  }, [session]);

  const nearAccountId = getNearAccountId(linkedAccounts);

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
          <NearProfile variant="badge" showAvatar={true} showName={true} />
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
                // Sign out from auth session
                await authClient.signOut({
                  fetchOptions: {
                    onSuccess: async () => {
                      await authClient.near.disconnect(); // TODO: this could be moved to signOut
                      navigate({
                        to: "/",
                      });
                    },
                  },
                });
              } catch (error) {
                console.error("Sign out error:", error);
                // Still navigate even if wallet disconnect fails
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
