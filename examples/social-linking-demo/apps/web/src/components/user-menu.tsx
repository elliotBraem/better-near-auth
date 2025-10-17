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
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { NearProfile } from "./near-profile";

interface Profile {
  name?: string;
  description?: string;
  image?: {
    url?: string;
    ipfs_cid?: string;
  };
  backgroundImage?: {
    url?: string;
    ipfs_cid?: string;
  };
  linktree?: Record<string, string>;
}

export default function UserMenu() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nearProfile, setNearProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchSessionAndProfile = async () => {
      try {
        const { data: sessionData } = await authClient.getSession();
        setSession(sessionData);
        
        if (sessionData) {
          try {
            const { data: response } = await authClient.near.getProfile();
            setNearProfile(response);
          } catch (err) {
            console.log("No NEAR profile found for user");
            setNearProfile(null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionAndProfile();
  }, []);

  if (isLoading) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Button variant="outline" asChild className="min-h-9 min-w-[80px]">
        <Link to="/login">Sign In</Link>
      </Button>
    );
  }

  const avatarUrl =
    nearProfile?.image?.url || nearProfile?.image?.ipfs_cid
      ? `https://ipfs.near.social/ipfs/${nearProfile.image.ipfs_cid}`
      : null;

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
        <DropdownMenuItem className="py-3 text-sm">{session.user.name}</DropdownMenuItem>
        {nearProfile && (
          <DropdownMenuItem className="py-3">
            <div className="flex items-center space-x-2">
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="NEAR Profile"
                  className="h-4 w-4 rounded-full object-cover"
                />
              )}
              <span className="text-xs text-muted-foreground">
                NEAR: {nearProfile.name || "Connected"}
              </span>
            </div>
          </DropdownMenuItem>
        )}
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
