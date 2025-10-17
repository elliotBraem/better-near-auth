import { authClient } from "@/lib/auth-client";
import { handleAccountLinkRefresh } from "@/lib/auth-utils";
import { Focus, UserMinus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export default function AccountLinking() {
  const { data: session, isPending } = authClient.useSession();
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isLinkingGitHub, setIsLinkingGitHub] = useState(false);
  const [isProcessingNear, setIsProcessingNear] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nearAccountId, setNearAccountId] = useState<string | null>(null);

  const fetchNearAccountId = () => setNearAccountId(authClient.near.getAccountId());

  // Initial fetch and handle OAuth callbacks and wallet state
  useEffect(() => {
    if (session) {
      // Handle potential OAuth callback redirects
      handleAccountLinkRefresh(
        { linkedAccounts, setLinkedAccounts },
        setLinkedAccounts,
        refreshAccounts
      );
      // Update wallet connection state
      fetchNearAccountId();
    } else {
      setLinkedAccounts([]);
      setError(null);
      fetchNearAccountId(); // Still useful to have wallet state
    }
  }, [session]);

  if (isPending) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  // Fetch linked accounts
  const refreshAccounts = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const accountsResponse = await authClient.listAccounts();
      setLinkedAccounts(accountsResponse.data || []);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch linked accounts:", err);
      setError("Failed to load linked accounts");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLinkSocial = async (providerId: "google" | "github") => {
    if (providerId === "google") setIsLinkingGoogle(true);
    else setIsLinkingGitHub(true);

    try {
      await authClient.linkSocial({
        provider: providerId,
        callbackURL: window.location.href,
      });
    } catch (error) {
      console.error(`Failed to link ${providerId}:`, error);
      toast.error(
        `Failed to link ${providerId === "google" ? "Google" : "GitHub"} account`
      );
      if (providerId === "google") setIsLinkingGoogle(false);
      else setIsLinkingGitHub(false);
    }
  };

  const handleNearAction = async () => {
    setIsProcessingNear(true);
    try {
      if (!nearAccountId) {
        // Phase 1: Connect wallet
        await authClient.requestSignIn.near(
          { recipient: "better-near-auth.near" },
          {
            onSuccess: () => {
              setIsProcessingNear(false);
              fetchNearAccountId();
            },
            onError: async (error: any) => {
              setIsProcessingNear(false);
              console.error("Wallet connection failed:", error);
              const errorMessage = error.code === "SIGNER_NOT_AVAILABLE"
                ? "NEAR wallet not available"
                : error.message || "Failed to connect wallet";
              toast.error(errorMessage);
              // No auto-disconnect needed here since wallet wasn't connected
            }
          }
        );
      } else {
        // Phase 2: Link account
        await authClient.near.link(
          { recipient: "better-near-auth.near" },
          {
            onSuccess: () => {
              toast.success("NEAR account linked successfully");
              refreshAccounts();
              setIsProcessingNear(false);
            },
            onError: async (error: any) => {
              console.error("NEAR link error:", error);
              toast.error(error.message || "Failed to link NEAR account");
              setIsProcessingNear(false);
              // Auto-disconnect wallet on link failure to reset state
              await authClient.near.disconnect();
              fetchNearAccountId();
            }
          }
        );
      }
    } catch (error) {
      console.error("Failed to process NEAR action:", error);
      setIsProcessingNear(false);
      toast.error("Failed to process NEAR action");
    }
  };

  const handleUnlinkNearAccount = async (account: any) => {
    setIsUnlinking(account.accountId);
    try {
      const [accountId, network] = account.accountId.split(":");
      const response = await authClient.near.unlink({
        accountId,
        network: (network as "mainnet" | "testnet") || "mainnet"
      });

      if (response.data?.success) {
        toast.success("NEAR account unlinked successfully");
        refreshAccounts();
      } else {
        toast.error("Failed to unlink NEAR account");
      }
    } catch (error) {
      console.error("Failed to unlink NEAR account:", error);
      toast.error("Failed to unlink NEAR account");
    } finally {
      setIsUnlinking(null);
    }
  };

  const handleUnlinkAccount = async (providerId: string) => {
    setIsUnlinking(providerId);
    try {
      await authClient.unlinkAccount({
        providerId,
      });
      toast.success("Account unlinked successfully");
      // Refresh accounts list
      const accountsResponse = await authClient.listAccounts();
      setLinkedAccounts(accountsResponse.data || []);
    } catch (error) {
      console.error("Failed to unlink account:", error);
      toast.error("Failed to unlink account");
    } finally {
      setIsUnlinking(null);
    }
  };

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case "google":
        return "🔵"; // Simple text representation
      case "github":
        return "⚫";
      case "siwn":
        return "🔗";
      default:
        return <UserMinus className="h-4 w-4" />;
    }
  };

  const getProviderName = (providerId: string) => {
    switch (providerId) {
      case "google":
        return "Google";
      case "github":
        return "GitHub";
      case "siwn":
        return "NEAR";
      default:
        if (!providerId) return "Unknown";
        return providerId?.charAt(0).toUpperCase() + providerId?.slice(1);
    }
  };

  // Determine primary account - NEAR if linked, otherwise first account
  const primaryAccount =
    linkedAccounts.find((acc) => acc.providerId === "siwn") || linkedAccounts[0];
  const secondaryAccounts = linkedAccounts.filter(
    (acc) => acc !== primaryAccount
  );

  const isProviderLinked = (providerId: string) => {
    return linkedAccounts.some((account) => account.providerId === providerId);
  };

  // Check if account can be unlinked
  const canUnlinkAccount = (account: any) => {
    // Can't unlink primary account
    if (account === primaryAccount) return false;
    // Can't unlink if it's the only account
    if (linkedAccounts.length === 1) return false;
    return true;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Focus className="h-5 w-5" />
          Connected Accounts
        </CardTitle>
        <CardDescription>
          Manage your linked authentication providers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Account Section */}
        {primaryAccount && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              Primary Account
              <Badge variant="secondary" className="text-xs">
                Can't be unlinked
              </Badge>
            </h4>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {getProviderIcon(primaryAccount.providerId)}
                </span>
                <div>
                  <span className="font-medium">
                    {getProviderName(primaryAccount.providerId)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {primaryAccount.accountId}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">Primary</span>
            </div>
          </div>
        )}

        {/* Secondary Accounts Section */}
        {secondaryAccounts.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Secondary Accounts</h4>
            {secondaryAccounts.map((account) => (
              <div
                key={account.providerId || account.accountId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {getProviderIcon(account.providerId)}
                  </span>
                  <div>
                    <span className="font-medium">
                      {getProviderName(account.providerId)}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {account.accountId}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (account.providerId === "siwn") {
                      handleUnlinkNearAccount(account);
                    } else {
                      handleUnlinkAccount(account.providerId);
                    }
                  }}
                  disabled={
                    isUnlinking === (account.providerId || account.accountId) ||
                    !canUnlinkAccount(account)
                  }
                  className="text-destructive hover:text-destructive"
                >
                  {isUnlinking === (account.providerId || account.accountId)
                    ? "Unlinking..."
                    : "Unlink"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Available Providers to Link */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Add New Account</h4>

          {/* Google */}
          {!isProviderLinked("google") && (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleLinkSocial("google")}
              disabled={isLinkingGoogle}
            >
              <span className="mr-2">🔵</span>
              {isLinkingGoogle ? "Linking Google..." : "Link Google Account"}
            </Button>
          )}

          {/* GitHub */}
          {!isProviderLinked("github") && (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleLinkSocial("github")}
              disabled={isLinkingGitHub}
            >
              <span className="mr-2">⚫</span>
              {isLinkingGitHub ? "Linking GitHub..." : "Link GitHub Account"}
            </Button>
          )}

          {/* NEAR */}
          {!isProviderLinked("siwn") && (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={handleNearAction}
              disabled={isProcessingNear}
            >
              <span className="mr-2">🔗</span>
              {isProcessingNear
                ? (nearAccountId ? "Linking NEAR..." : "Connecting Wallet...")
                : `Link NEAR Account${nearAccountId ? ` (${nearAccountId})` : ""}`}
            </Button>
          )}
        </div>

        {linkedAccounts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No accounts linked yet. Add an account to enable cross-platform
            authentication.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
