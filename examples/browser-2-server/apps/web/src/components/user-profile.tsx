import { authClient } from "@/lib/auth-client";
import { getNearAccountId, getProviderConfig, getLinkedProviders } from "@/lib/auth-utils";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { User, ExternalLink } from "lucide-react";
import { NearProfile } from "./near-profile";

export default function UserProfile() {
  const { data: session, isPending } = authClient.useSession();
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);

  // Fetch linked accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accountsResponse = await authClient.listAccounts();
        setLinkedAccounts(accountsResponse.data || []);
      } catch (error) {
        console.error("Failed to fetch linked accounts:", error);
      }
    };

    if (session) {
      fetchAccounts();
    }
  }, [session]);

  if (isPending) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-4 w-32 bg-muted rounded animate-pulse mb-4" />
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const user = session?.user;
  const nearAccountId = getNearAccountId(linkedAccounts);
  const linkedProviderNames = getLinkedProviders(linkedAccounts);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile
        </CardTitle>
        <CardDescription>
          Your account information and linked providers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Info */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            {user?.image ? (
              <img
                src={user.image}
                alt="Profile"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <User className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{user?.name}</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>

            {/* Provider Badges */}
            {linkedProviderNames.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {linkedProviderNames.map(provider => {
                  console.log("provider", provider);
                  const config = getProviderConfig(provider);
                  return (
                    <Badge
                      key={provider}
                      variant="secondary"
                      className={`${config.backgroundColor} ${config.color} text-xs`}
                    >
                      <span className="mr-1">{config.icon}</span>
                      {config.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* NEAR Account Section */}
        {nearAccountId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">NEAR Profile</h4>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 px-3"
              >
                <a
                  href={`/profile/${nearAccountId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Public
                </a>
              </Button>
            </div>

            {/* NEAR Profile Preview */}
            <div className="border rounded-lg p-4">
              <NearProfile
                accountId={nearAccountId}
                variant="badge"
                showAvatar={true}
                showName={true}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {linkedProviderNames.length === 0 && (
          <div className="text-center py-4">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No linked accounts found
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
