import { authClient } from "@/lib/auth-client";
import { getNearAccountId, getLinkedProviders } from "@/lib/auth-utils";
import { orpc } from "@/utils/orpc";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { User, ExternalLink, Unlink, ShieldCheck, Clock, Key, Link2, Focus, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gas } from "near-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, Zap, Wallet, Copy, Check, RefreshCw, Search } from "lucide-react";
import { NearProfile } from "@/components/near-profile";
import { Link } from "@tanstack/react-router";
import RelayFeed from "@/components/relay-feed";

const GUESTBOOK_CONTRACT = "hello.near-examples.near";
type SendMode = "relay" | "direct";
type RelayStatus = "idle" | "pending" | "completed" | "failed";

function explorerTxUrl(txHash: string) {
  return `https://near.rocks/tx/${txHash}`;
}

interface RelayerData {
  enabled: boolean;
  accountId?: string;
  mode?: "ephemeral" | "explicit";
  network?: "mainnet" | "testnet";
  balance?: string;
  available?: string;
  staked?: string;
  storageUsage?: string;
  storageBytes?: number;
  hasContract?: boolean;
  hasKey?: boolean;
  createdAt?: string;
  lastUsedAt?: string;
}

function formatNear(yoctoNear: string): string {
  const near = Number(yoctoNear) / 1e24;
  if (near >= 1) return near.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (near > 0) return near.toExponential(2);
  return "0";
}

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 20) return accountId;
  return `${accountId.slice(0, 10)}...${accountId.slice(-6)}`;
}

function relayerExplorerUrl(accountId: string): string {
  return `https://near.rocks/account/${accountId}`;
}

function getProviderIcon(providerId: string) {
  switch (providerId) {
    case "google": return "🔵";
    case "github": return "⚫";
    case "siwn": return "🔗";
    default: return <UserMinus className="h-4 w-4" />;
  }
}

function getProviderName(providerId: string) {
  switch (providerId) {
    case "google": return "Google";
    case "github": return "GitHub";
    case "siwn": return "NEAR";
    default: return providerId?.charAt(0).toUpperCase() + providerId?.slice(1) || "Unknown";
  }
}

export const Route = createFileRoute("/_layout/dashboard")({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
  },
  loader: async () => {
    const [sessionRes, accountsRes, privateDataRes, greetingRes] = await Promise.all([
      authClient.getSession(),
      authClient.near.listAccounts(),
      fetch(`${import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? "http://localhost:3000" : "")}/rpc/privateData`, {
        credentials: "include",
        method: "GET",
      }).then(r => r.json()).catch(() => null),
      authClient.near.view({ contractId: GUESTBOOK_CONTRACT, methodName: "get_greeting" }).catch(() => null),
    ]);

    const session = sessionRes.data;
    const linkedAccounts = Array.isArray(accountsRes?.data) ? accountsRes.data : [];
    const sessionNearAccountId = (session?.user as any)?.nearAccount?.accountId;
    const nearAccountId = sessionNearAccountId
      ? sessionNearAccountId.split(":")[0]
      : getNearAccountId(linkedAccounts);
    const linkedProviders = getLinkedProviders(linkedAccounts);

    return {
      user: session?.user ?? null,
      nearAccountId,
      linkedAccounts,
      linkedProviders,
      privateData: privateDataRes,
      greeting: (greetingRes as any)?.data?.result as string | undefined,
    };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user, nearAccountId, linkedAccounts, linkedProviders, privateData, greeting: initialGreeting } = Route.useLoaderData();
  const queryClient = useQueryClient();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <ProfileCard user={user} nearAccountId={nearAccountId} linkedProviders={linkedProviders} linkedAccounts={linkedAccounts} />
        <RelayerCard />
        <AccountLinkingCard linkedAccounts={linkedAccounts} nearAccountId={nearAccountId} />
        <GuestbookCard initialGreeting={initialGreeting} />
        <SessionInfoCard user={user} nearAccountId={nearAccountId} linkedAccounts={linkedAccounts} privateData={privateData} />
        <ExploreCard />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction Feed</CardTitle>
          <CardDescription>Live-updating relay history</CardDescription>
        </CardHeader>
        <CardContent>
          <RelayFeed />
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileCard({ user, nearAccountId, linkedProviders, linkedAccounts }: {
  user: any;
  nearAccountId: string | null;
  linkedProviders: string[];
  linkedAccounts: any[];
}) {
  const queryClient = useQueryClient();
  const [isUnlinking, setIsUnlinking] = useState(false);
  const displayName = user?.name || nearAccountId || "User";
  const displayEmail = user?.email;
  const initial = (displayName)?.charAt(0).toUpperCase();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile
        </CardTitle>
        <CardDescription>Your account information and linked providers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            {user?.image ? (
              <img src={user.image} alt="Profile" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className="text-lg font-medium text-muted-foreground">{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{displayName}</h3>
            {displayEmail && <p className="text-sm text-muted-foreground">{displayEmail}</p>}
            {linkedProviders.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {linkedProviders.map(provider => {
                  const config = (() => {
                    switch (provider) {
                      case "google": return { icon: "🔵", name: "Google", backgroundColor: "bg-[#4285F4]", color: "text-white" };
                      case "github": return { icon: "⚫", name: "GitHub", backgroundColor: "bg-[#181717]", color: "text-white" };
                      case "siwn": return { icon: "🔗", name: "NEAR", backgroundColor: "bg-[#000000]", color: "text-white" };
                      default: return { icon: "🔗", name: provider, backgroundColor: "bg-gray-100", color: "text-muted-foreground" };
                    }
                  })();
                  return (
                    <Badge key={provider} variant="secondary" className={`${config.backgroundColor} ${config.color} text-xs`}>
                      <span className="mr-1">{config.icon}</span>
                      {config.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {nearAccountId && (
          <div className="flex items-center justify-between pt-1">
            <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{nearAccountId}</code>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                <a href={`/profile/${nearAccountId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                disabled={isUnlinking}
                onClick={async () => {
                  setIsUnlinking(true);
                  try {
                    const [accountId, network] = nearAccountId.includes(":")
                      ? nearAccountId.split(":")
                      : [nearAccountId, "mainnet"];
                    const response = await authClient.near.unlink({
                      accountId,
                      network: (network as "mainnet" | "testnet") || "mainnet",
                    });
                    if (response.data?.success) {
                      toast.success("NEAR account unlinked");
                      queryClient.invalidateQueries({ queryKey: ["near-accounts"] });
                    } else {
                      toast.error("Failed to unlink NEAR account");
                    }
                  } catch {
                    toast.error("Failed to unlink NEAR account");
                  } finally {
                    setIsUnlinking(false);
                  }
                }}
              >
                <Unlink className="h-3 w-3" />
                {isUnlinking ? "..." : "Unlink"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RelayerCard() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = useQuery<RelayerData>({
    queryKey: ["relayer-info"],
    queryFn: async () => {
      const response = await authClient.near.getRelayerInfo();
      return response.data as RelayerData;
    },
    refetchInterval: 2000,
  });

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Relayer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.enabled || !data.accountId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Relayer
          </CardTitle>
          <CardDescription>Gasless transaction relayer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm font-medium">Not Configured</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Enable the relayer in your server config to allow gasless transactions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isFunded = data.balance !== "0" && data.balance !== undefined;
  const statusLabel = isFunded ? "Active" : "Unfunded";
  const statusColor = isFunded ? "bg-emerald-500" : "bg-amber-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Relayer
        </CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${statusColor}`} />
          <span className="text-sm font-medium">{statusLabel}</span>
          <Badge variant={data.mode === "explicit" ? "default" : "secondary"}>
            {data.mode === "explicit" ? "Explicit" : "Ephemeral"}
          </Badge>
          <Badge variant="outline">{data.network}</Badge>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Ephemeral keypair — private key encrypted in your database</span>
          </div>
          <p className="text-xs text-muted-foreground pl-[22px]">
            Auto-generated ED25519 keypair. AES-256-GCM encrypted with BETTER_AUTH_SECRET via HKDF. Stored only in SQLite.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account</span>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
              {truncateAccountId(data.accountId)}
            </code>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(data.accountId!)}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <a href={relayerExplorerUrl(data.accountId)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-sm font-medium">{formatNear(data.balance ?? "0")} NEAR</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="text-sm font-medium">{formatNear(data.available ?? "0")} NEAR</div>
          </div>
        </div>

        {!isFunded && (
          <div className="border border-dashed rounded-lg p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Fund this account to enable gasless relay</p>
            <code className="text-xs font-mono break-all select-all bg-muted px-2 py-1 rounded block">
              {data.accountId}
            </code>
          </div>
        )}

        {(data.createdAt || data.lastUsedAt) && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {data.createdAt && <div>Created: {new Date(data.createdAt).toLocaleDateString()}</div>}
            {data.lastUsedAt && <div>Last used: {new Date(data.lastUsedAt).toLocaleDateString()}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountLinkingCard({ linkedAccounts, nearAccountId }: {
  linkedAccounts: any[];
  nearAccountId: string | null;
}) {
  const queryClient = useQueryClient();
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isLinkingGitHub, setIsLinkingGitHub] = useState(false);
  const [isProcessingNear, setIsProcessingNear] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);

  const walletAccountId = authClient.near.getAccountId();
  const accounts = linkedAccounts;

  const invalidateAccounts = () =>
    queryClient.invalidateQueries({ queryKey: ["near-accounts"] });

  const handleLinkSocial = async (providerId: "google" | "github") => {
    if (providerId === "google") setIsLinkingGoogle(true);
    else setIsLinkingGitHub(true);
    try {
      await authClient.linkSocial({ provider: providerId, callbackURL: window.location.href });
    } catch (error) {
      console.error(`Failed to link ${providerId}:`, error);
      toast.error(`Failed to link ${providerId === "google" ? "Google" : "GitHub"} account`);
      if (providerId === "google") setIsLinkingGoogle(false);
      else setIsLinkingGitHub(false);
    }
  };

  const handleNearAction = async () => {
    setIsProcessingNear(true);
    try {
      await authClient.near.link({
        onSuccess: () => {
          toast.success("NEAR account linked successfully");
          invalidateAccounts();
          setIsProcessingNear(false);
        },
        onError: async (error: any) => {
          console.error("NEAR link error:", error);
          const errorMessage = error.code === "SIGNER_NOT_AVAILABLE"
            ? "NEAR wallet not available"
            : error.message || "Failed to link NEAR account";
          toast.error(errorMessage);
          setIsProcessingNear(false);
          await authClient.near.disconnect();
        },
      });
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
        network: (network as "mainnet" | "testnet") || "mainnet",
      });
      if (response.data?.success) {
        toast.success("NEAR account unlinked successfully");
        invalidateAccounts();
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
      await authClient.unlinkAccount({ providerId });
      toast.success("Account unlinked successfully");
      invalidateAccounts();
    } catch (error) {
      console.error("Failed to unlink account:", error);
      toast.error("Failed to unlink account");
    } finally {
      setIsUnlinking(null);
    }
  };

  const primaryAccount = accounts.find((acc) => acc.providerId === "siwn") || accounts[0];
  const secondaryAccounts = accounts.filter((acc) => acc !== primaryAccount);
  const isProviderLinked = (providerId: string) => accounts.some((a) => a.providerId === providerId);
  const canUnlinkAccount = (account: any) => account !== primaryAccount && accounts.length > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Focus className="h-5 w-5" />
          Connected Accounts
        </CardTitle>
        <CardDescription>Manage your linked authentication providers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {primaryAccount && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              Primary Account
              <Badge variant="secondary" className="text-xs">Can't be unlinked</Badge>
            </h4>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="text-lg">{getProviderIcon(primaryAccount.providerId)}</span>
                <div>
                  <span className="font-medium">{getProviderName(primaryAccount.providerId)}</span>
                  <span className="text-sm text-muted-foreground ml-2">{primaryAccount.accountId}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">Primary</span>
            </div>
          </div>
        )}

        {secondaryAccounts.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Secondary Accounts</h4>
            {secondaryAccounts.map((account) => (
              <div key={account.providerId || account.accountId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getProviderIcon(account.providerId)}</span>
                  <div>
                    <span className="font-medium">{getProviderName(account.providerId)}</span>
                    <span className="text-sm text-muted-foreground ml-2">{account.accountId}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => account.providerId === "siwn" ? handleUnlinkNearAccount(account) : handleUnlinkAccount(account.providerId)}
                  disabled={isUnlinking === (account.providerId || account.accountId) || !canUnlinkAccount(account)}
                  className="text-destructive hover:text-destructive"
                >
                  {isUnlinking === (account.providerId || account.accountId) ? "Unlinking..." : "Unlink"}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <h4 className="font-medium text-sm">Add New Account</h4>
          {!isProviderLinked("google") && (
            <Button type="button" variant="outline" className="w-full justify-start" onClick={() => handleLinkSocial("google")} disabled={isLinkingGoogle}>
              <span className="mr-2">🔵</span>
              {isLinkingGoogle ? "Linking Google..." : "Link Google Account"}
            </Button>
          )}
          {!isProviderLinked("github") && (
            <Button type="button" variant="outline" className="w-full justify-start" onClick={() => handleLinkSocial("github")} disabled={isLinkingGitHub}>
              <span className="mr-2">⚫</span>
              {isLinkingGitHub ? "Linking GitHub..." : "Link GitHub Account"}
            </Button>
          )}
          {!isProviderLinked("siwn") && (
            <Button type="button" variant="outline" className="w-full justify-start" onClick={handleNearAction} disabled={isProcessingNear}>
              <span className="mr-2">🔗</span>
              {isProcessingNear
                ? (walletAccountId ? "Linking NEAR..." : "Connecting Wallet...")
                : `Link NEAR Account${walletAccountId ? ` (${walletAccountId})` : ""}`}
            </Button>
          )}
        </div>

        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No accounts linked yet. Add an account to enable cross-platform authentication.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GuestbookCard({ initialGreeting }: { initialGreeting?: string }) {
  const [newGreeting, setNewGreeting] = useState("");
  const [sendMode, setSendMode] = useState<SendMode>("relay");
  const [relayStatus, setRelayStatus] = useState<RelayStatus>("idle");
  const [relayTxHash, setRelayTxHash] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const network = (authClient.near.getState()?.networkId || "mainnet") as "mainnet" | "testnet";
  const queryKey = ["greeting", network];

  const { data: greeting } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await authClient.near.view({ contractId: GUESTBOOK_CONTRACT, methodName: "get_greeting" });
      return res.data?.result as string;
    },
    initialData: initialGreeting,
  });

  useEffect(() => {
    if (relayStatus !== "pending" || !relayTxHash) return;
    const interval = setInterval(async () => {
      try {
        const res = await authClient.near.getRelayStatus(relayTxHash);
        const status = res.data?.status;
        if (status === "completed" || status === "failed") {
          setRelayStatus(status);
          queryClient.invalidateQueries({ queryKey });
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [relayStatus, relayTxHash]);

  const optimisticUpdate = async (text: string) => {
    await queryClient.cancelQueries({ queryKey });
    const previousGreeting = queryClient.getQueryData<string>(queryKey);
    queryClient.setQueryData(queryKey, text);
    return { previousGreeting };
  };

  const rollback = (context: { previousGreeting?: string } | undefined) => {
    if (context?.previousGreeting !== undefined) {
      queryClient.setQueryData(queryKey, context.previousGreeting);
    }
  };

  const { mutate: addMessageRelay, isPending: isRelaying } = useMutation({
    mutationFn: async (text: string) => {
      const accountId = authClient.near.getAccountId();
      if (!accountId) throw new Error("Not authenticated");
      const signedDelegateAction = await authClient.near.buildSignedDelegateAction(
        GUESTBOOK_CONTRACT,
        (builder) => builder.functionCall(GUESTBOOK_CONTRACT, "set_greeting", { greeting: text }, {
          gas: Gas.Tgas(30),
          attachedDeposit: BigInt(0),
        }),
      );
      const relayResult = await authClient.near.relayTransaction({ payload: signedDelegateAction });
      if (relayResult.error) throw new Error(relayResult.error.message || "Relay failed");
      return relayResult.data;
    },
    onMutate: async (text) => {
      const context = await optimisticUpdate(text);
      setNewGreeting("");
      setRelayStatus("pending");
      setRelayTxHash(null);
      return context;
    },
    onSuccess: (data) => {
      setRelayTxHash(data?.txHash ?? null);
      queryClient.invalidateQueries({ queryKey: ["relay-history"] });
      toast.success("Message relayed (gasless)!");
    },
    onError: (error, _vars, context) => {
      rollback(context);
      setRelayStatus("failed");
      console.error("Relay error:", error);
      toast.error(error instanceof Error ? error.message : "Relay failed. Try direct mode.");
    },
  });

  const { mutate: addMessageDirect, isPending: isDirecting } = useMutation({
    mutationFn: async (text: string) => {
      const accountId = authClient.near.getAccountId();
      if (!accountId) throw new Error("Not authenticated");
      return authClient.near.client
        .transaction(accountId)
        .functionCall(GUESTBOOK_CONTRACT, "set_greeting", { greeting: text }, {
          gas: Gas.Tgas(30),
          attachedDeposit: BigInt(0),
        })
        .send({ waitUntil: "FINAL" });
    },
    onMutate: async (text) => {
      const context = await optimisticUpdate(text);
      setNewGreeting("");
      return context;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relay-history"] });
      queryClient.invalidateQueries({ queryKey });
      toast.success("Message sent directly!");
    },
    onError: (error, _vars, context) => {
      rollback(context);
      console.error("Direct send error:", error);
      toast.error(error instanceof Error ? error.message : "Direct send failed.");
    },
  });

  const isPending = isRelaying || isDirecting;
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGreeting.trim()) return;
    sendMode === "relay" ? addMessageRelay(newGreeting) : addMessageDirect(newGreeting);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Guestbook</CardTitle>
          <div className="flex gap-1">
            <Button variant={sendMode === "relay" ? "default" : "outline"} size="sm" onClick={() => setSendMode("relay")}>
              <Zap className="h-3.5 w-3.5 mr-1" />
              Gasless
              {sendMode === "relay" && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">Relay</Badge>}
            </Button>
            <Button variant={sendMode === "direct" ? "default" : "outline"} size="sm" onClick={() => setSendMode("direct")}>
              <Wallet className="h-3.5 w-3.5 mr-1" />
              Direct
              {sendMode === "direct" && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">You Pay Gas</Badge>}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          {sendMode === "relay"
            ? "Server pays gas via relayer keypair — no NEAR tokens needed from you"
            : "You sign and pay gas from your wallet"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input placeholder="Leave a message..." value={newGreeting} onChange={(e) => setNewGreeting(e.target.value)} disabled={isPending} className="flex-1" />
          <Button type="submit" disabled={isPending || !newGreeting.trim()}>
            {isPending ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{sendMode === "relay" ? "Relaying..." : "Sending..."}</span>
              </div>
            ) : "Add"}
          </Button>
        </form>

        {sendMode === "relay" && relayStatus !== "idle" && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
            {relayStatus === "pending" && (
              <><Loader2 className="h-4 w-4 animate-spin text-amber-500" /><span className="text-sm">Submitting to chain...</span></>
            )}
            {relayStatus === "completed" && (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">Confirmed on chain</span>
                {relayTxHash && (
                  <a href={explorerTxUrl(relayTxHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 ml-1">
                    <code className="font-mono">{relayTxHash.slice(0, 8)}...</code>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
            {relayStatus === "failed" && <span className="text-sm text-destructive">Relay failed — try direct mode</span>}
          </div>
        )}

        <div className="space-y-3">
          {greeting ? (
            <div className="max-h-64 overflow-y-auto space-y-3">
              <div className="border-l-2 border-muted pl-3 py-2">
                <p className="text-xs text-muted-foreground font-medium mb-1">Last message:</p>
                <p className="text-sm">{greeting}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Be the first to leave one!</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SessionInfoCard({ user, nearAccountId, linkedAccounts, privateData }: {
  user: any;
  nearAccountId: string | null;
  linkedAccounts: any[];
  privateData: any;
}) {
  const providerCount = linkedAccounts.length;
  const nearAccountCount = linkedAccounts.filter(a => a.providerId === "siwn").length;
  const socialAccountCount = providerCount - nearAccountCount;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Server-Only Data
          </CardTitle>
          <CardDescription>This data is only accessible to authenticated users via your server session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border rounded-md p-4">
            <p className="text-sm">{privateData?.message ?? "Loading..."}</p>
          </div>
          {privateData && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" /> Session ID
                </span>
                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  {privateData.sessionId?.slice(0, 12)}...
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Expires
                </span>
                <span className="text-xs">
                  {privateData.expiresAt ? new Date(privateData.expiresAt).toLocaleString() : "N/A"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">User</span>
            <span className="font-medium">{user?.name || nearAccountId || "Unknown"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="text-xs">{user?.email || "N/A"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">NEAR Account</span>
            {nearAccountId ? (
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{nearAccountId}</code>
            ) : (
              <span className="text-xs text-muted-foreground">None</span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Linked Providers</span>
            <div className="flex gap-1">
              {nearAccountCount > 0 && <Badge variant="secondary" className="text-xs">NEAR</Badge>}
              {socialAccountCount > 0 && <Badge variant="secondary" className="text-xs">{socialAccountCount} OAuth</Badge>}
              {providerCount === 0 && <span className="text-xs text-muted-foreground">None</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExploreCard() {
  const [searchId, setSearchId] = useState("");
  const [queryId, setQueryId] = useState<string | undefined>(undefined);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["near-profile", queryId],
    queryFn: async () => {
      const res = await authClient.near.getProfile(queryId);
      return res.data || null;
    },
    enabled: !!queryId,
  });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = searchId.trim();
    if (id) setQueryId(id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Explore
        </CardTitle>
        <CardDescription>Browse NEAR Social profiles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSearch} className="flex gap-2">
          <Input placeholder="Enter a NEAR account ID" value={searchId} onChange={(e) => setSearchId(e.target.value)} className="flex-1" />
          <Button type="submit" disabled={!searchId.trim()}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </form>

        {queryId && (
          <div className="space-y-3">
            {isLoading && <div className="p-4 text-center text-sm text-muted-foreground">Loading profile...</div>}
            {error && <div className="p-4 text-center text-sm text-muted-foreground">Failed to load profile for {queryId}</div>}
            {!isLoading && !error && profile && (
              <div className="space-y-3">
                <NearProfile accountId={queryId} variant="card" showAvatar showName />
                <Link to="/profile/$accountId" params={{ accountId: queryId }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View full profile page
                </Link>
              </div>
            )}
            {!isLoading && !error && !profile && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No NEAR Social profile found for <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{queryId}</code>
              </div>
            )}
          </div>
        )}

        {!queryId && (
          <div className="text-center py-4 text-muted-foreground">
            <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Search for any NEAR account</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
