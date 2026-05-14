import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Focus,
  Key,
  Loader2,
  Search,
  ShieldCheck,
  Unlink,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { Gas } from "near-kit";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type Organization,
  type SessionData,
  sessionQueryOptions,
  useApiClient,
  useAuthClient,
} from "@/app";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components";
import { Input } from "@/components/ui/input";
import { getLinkedProviders, getNearAccountId, getProviderConfig } from "@/lib/auth-utils";
import { NearProfile } from "./near-profile";
import RelayFeed from "./relay-feed";

const GUESTBOOK_CONTRACT = "hello.near-examples.near";
type SendMode = "relay" | "direct";
type RelayStatus = "idle" | "pending" | "completed" | "failed";

export interface RelayerData {
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

export interface NearAccountsData {
  accounts: any[];
}

function explorerTxUrl(txHash: string) {
  return `https://near.rocks/tx/${txHash}`;
}

function formatNear(yoctoNear: string): string {
  const near = Number(yoctoNear) / 1e24;
  if (near >= 1) return near.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (near > 0) return near.toExponential(2);
  return "0";
}

function hasPositiveYoctoBalance(balance?: string): boolean {
  if (!balance?.trim()) return false;
  try {
    return BigInt(balance) > 0n;
  } catch {
    return false;
  }
}

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 20) return accountId;
  return `${accountId.slice(0, 10)}...${accountId.slice(-6)}`;
}

function relayerExplorerUrl(accountId: string): string {
  return `https://near.rocks/account/${accountId}`;
}

function getGuestbookGreetingQueryKey(network: "mainnet" | "testnet") {
  return ["greeting", network] as const;
}

export function getAccountProviderId(account: any): string {
  return account?.providerId ?? (account?.accountId ? "siwn" : "unknown");
}

export function useNearAccountsData(enabled = true) {
  const auth = useAuthClient();

  return useQuery<NearAccountsData>({
    queryKey: ["near-accounts"],
    queryFn: async () => {
      const res = await auth.near.listAccounts();
      const accounts = res?.data?.accounts;
      return {
        accounts: Array.isArray(accounts) ? accounts : [],
      };
    },
    enabled,
  });
}

export function useOrganizationsData() {
  const auth = useAuthClient();

  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data } = await auth.organization.list();
      return (data || []) as Organization[];
    },
    staleTime: 30 * 1000,
  });
}

export function usePrivateData(enabled = true) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ["private-data"],
    queryFn: () => apiClient.privateData(),
    enabled,
  });
}

export function useRelayerInfo() {
  const auth = useAuthClient();

  return useQuery<RelayerData>({
    queryKey: ["relayer-info"],
    queryFn: async () => {
      const response = await auth.near.getRelayerInfo();
      return response.data as RelayerData;
    },
  });
}

export function useGuestbookGreeting(enabled = true) {
  const auth = useAuthClient();
  const network = (auth.near.getState()?.networkId || "mainnet") as "mainnet" | "testnet";

  return useQuery({
    queryKey: getGuestbookGreetingQueryKey(network),
    queryFn: async () => {
      const res = await auth.near.view({
        contractId: GUESTBOOK_CONTRACT,
        methodName: "get_greeting",
      });
      const result = res?.data?.result;
      return typeof result === "string" ? result : undefined;
    },
    enabled,
  });
}

export function getActiveNearAccountId(nearAccountsData: NearAccountsData) {
  return getNearAccountId(nearAccountsData.accounts);
}

export function getLinkedNearProviders(accounts: any[]) {
  return getLinkedProviders(accounts);
}

export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] p-4 bg-card">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export function ProfileCard({
  user,
  nearAccountId,
  linkedProviders,
  linkedAccounts,
}: {
  user: any;
  nearAccountId: string | null;
  linkedProviders: string[];
  linkedAccounts: any[];
}) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const [isUnlinking, setIsUnlinking] = useState(false);
  const displayName = user?.name || nearAccountId || "User";
  const displayEmail = user?.email;
  const initial = displayName?.charAt(0).toUpperCase();
  const currentNearAccount = linkedAccounts.find(
    (account) =>
      getAccountProviderId(account) === "siwn" &&
      account.accountId?.split(":")[0] === nearAccountId,
  );
  const canUnlinkNearAccount = Boolean(
    currentNearAccount &&
      !currentNearAccount.isActive &&
      !currentNearAccount.isPrimary &&
      linkedAccounts.length > 1,
  );

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
              <img
                src={user.image}
                alt="Profile"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium text-muted-foreground">{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{displayName}</h3>
            {displayEmail && <p className="text-sm text-muted-foreground">{displayEmail}</p>}
            {linkedProviders.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {linkedProviders.map((provider) => {
                  const config = getProviderConfig(provider);
                  return (
                    <Badge key={provider} variant="secondary" className="text-xs">
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
                <Link
                  to="/account/$accountId"
                  params={{ accountId: nearAccountId }}
                  className="flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Social
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                disabled={isUnlinking || !canUnlinkNearAccount}
                title={
                  canUnlinkNearAccount
                    ? "Unlink NEAR account"
                    : "Active NEAR account can't be unlinked here"
                }
                onClick={async () => {
                  if (!canUnlinkNearAccount) return;
                  setIsUnlinking(true);
                  try {
                    const [accountId, network] = nearAccountId.includes(":")
                      ? nearAccountId.split(":")
                      : [nearAccountId, "mainnet"];
                    const response = await auth.near.unlink({
                      accountId,
                      network:
                        (currentNearAccount?.network as "mainnet" | "testnet") ||
                        (network as "mainnet" | "testnet") ||
                        "mainnet",
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

export function RelayerCard() {
  const [copied, setCopied] = useState(false);
  const { data, isLoading } = useRelayerInfo();

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

  const isFunded = hasPositiveYoctoBalance(data.balance);
  const statusLabel = isFunded ? "Active" : "Unfunded";
  const statusColor = isFunded ? "bg-green-500" : "bg-amber-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Relayer
        </CardTitle>
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
            <span className="text-sm font-medium">
              Ephemeral keypair — private key encrypted in your database
            </span>
          </div>
          <p className="text-xs text-muted-foreground pl-[22px]">
            Auto-generated ED25519 keypair. AES-256-GCM encrypted with BETTER_AUTH_SECRET via HKDF.
            Stored only in SQLite.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Account
          </span>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
              {truncateAccountId(data.accountId)}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleCopy(data.accountId!)}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <a
                href={relayerExplorerUrl(data.accountId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] p-3">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-sm font-medium">{formatNear(data.balance ?? "0")} NEAR</div>
          </div>
          <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] p-3">
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="text-sm font-medium">{formatNear(data.available ?? "0")} NEAR</div>
          </div>
        </div>

        {!isFunded && (
          <div className="border-2 border-dashed border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] rounded-lg p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Fund this account to enable gasless relay
            </p>
            <code className="text-xs font-mono break-all select-all bg-muted px-2 py-1 rounded block">
              {data.accountId}
            </code>
          </div>
        )}

        {(data.createdAt || data.lastUsedAt) && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {data.createdAt && <div>Created: {new Date(data.createdAt).toLocaleDateString()}</div>}
            {data.lastUsedAt && (
              <div>Last used: {new Date(data.lastUsedAt).toLocaleDateString()}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AccountLinkingCard({ linkedAccounts, user }: { linkedAccounts: any[]; user: any }) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isLinkingGitHub, setIsLinkingGitHub] = useState(false);
  const [isProcessingNear, setIsProcessingNear] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);
  const [recentlyLinked, setRecentlyLinked] = useState<{
    provider: string;
    accountId: string;
  } | null>(null);

  const isAnonymous = user?.isAnonymous ?? false;
  const walletAccountId = auth.near.getAccountId();
  const accounts = linkedAccounts;

  const invalidateAccounts = () => {
    void queryClient.invalidateQueries({ queryKey: ["near-accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["session"] });
    void router.invalidate();
  };

  const handleLinkSocial = async (providerId: "google" | "github") => {
    if (providerId === "google") setIsLinkingGoogle(true);
    else setIsLinkingGitHub(true);
    try {
      await auth.linkSocial({
        provider: providerId,
        callbackURL: window.location.href,
      });
      toast.success(`${providerId === "google" ? "Google" : "GitHub"} account linked successfully`);
      invalidateAccounts();
      setRecentlyLinked({ provider: providerId, accountId: providerId });
      setTimeout(() => setRecentlyLinked(null), 5000);
    } catch (error) {
      console.error(`Failed to link ${providerId}:`, error);
      toast.error(`Failed to link ${providerId === "google" ? "Google" : "GitHub"} account`);
    } finally {
      if (providerId === "google") setIsLinkingGoogle(false);
      else setIsLinkingGitHub(false);
    }
  };

  const handleNearAction = async () => {
    setIsProcessingNear(true);
    try {
      await auth.near.link({
        onSuccess: (ctx?: any) => {
          const linkedAccountId = ctx?.data?.accountId || walletAccountId || "NEAR account";
          toast.success(
            `NEAR account "${linkedAccountId}" linked successfully${isAnonymous ? " — your session is now persistent" : ""}`,
          );
          invalidateAccounts();
          setIsProcessingNear(false);
          setRecentlyLinked({ provider: "siwn", accountId: linkedAccountId });
          setTimeout(() => setRecentlyLinked(null), 5000);
        },
        onError: async (error: any) => {
          console.error("NEAR link error:", error);
          const errorMessage =
            error.code === "SIGNER_NOT_AVAILABLE"
              ? "NEAR wallet not available"
              : error.message || "Failed to link NEAR account";
          toast.error(errorMessage);
          setIsProcessingNear(false);
          await auth.near.disconnect();
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
      const [accountId, fallbackNetwork] = account.accountId.split(":");
      const response = await auth.near.unlink({
        accountId,
        network:
          (account.network as "mainnet" | "testnet") ||
          (fallbackNetwork as "mainnet" | "testnet") ||
          "mainnet",
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
      await auth.unlinkAccount({ providerId });
      toast.success("Account unlinked successfully");
      invalidateAccounts();
    } catch (error) {
      console.error("Failed to unlink account:", error);
      toast.error("Failed to unlink account");
    } finally {
      setIsUnlinking(null);
    }
  };

  const primaryAccount = accounts.find((acc) => acc.isActive || acc.isPrimary) || accounts[0];
  const secondaryAccounts = accounts.filter((acc) => acc !== primaryAccount);
  const isProviderLinked = (providerId: string) =>
    accounts.some((a) => getAccountProviderId(a) === providerId);
  const canUnlinkAccount = (account: any) => account !== primaryAccount && accounts.length > 1;
  const accountKey = (account: any) =>
    `${getAccountProviderId(account)}:${account.network ?? ""}:${account.accountId ?? account.id ?? ""}`;
  const accountActionId = (account: any) =>
    getAccountProviderId(account) === "siwn"
      ? account.accountId
      : account.providerId || getAccountProviderId(account);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Focus className="h-5 w-5" />
            Connected Accounts
          </CardTitle>
          <CardDescription>Manage your linked authentication providers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAnonymous && (
            <div className="border-2 border-dashed border-[rgb(180,50,40)] dark:border-[rgb(200,80,70)] bg-destructive/5 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground">Temporary session.</strong> Link an account to
              make your data persistent and recoverable.
            </div>
          )}

          {recentlyLinked && (
            <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-green-50 dark:bg-green-900/20 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ✓ Linked successfully:
                </span>
                <span className="font-mono break-all">{recentlyLinked.accountId}</span>
                <span className="text-muted-foreground">
                  ({getProviderConfig(recentlyLinked.provider).name})
                </span>
              </div>
            </div>
          )}

          {primaryAccount && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                Primary Account
                <Badge variant="secondary" className="text-xs">
                  Can&apos;t be unlinked
                </Badge>
              </h4>
              <div className="flex flex-col gap-3 p-3 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <span className="text-lg">
                    {getProviderConfig(getAccountProviderId(primaryAccount)).icon}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium block sm:inline">
                      {getProviderConfig(getAccountProviderId(primaryAccount)).name}
                    </span>
                    <span className="text-sm text-muted-foreground break-all sm:ml-2">
                      {primaryAccount.accountId}
                    </span>
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
                <div
                  key={accountKey(account)}
                  className="flex flex-col gap-3 p-3 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3 sm:items-center">
                    <span className="text-lg">
                      {getProviderConfig(getAccountProviderId(account)).icon}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium block sm:inline">
                        {getProviderConfig(getAccountProviderId(account)).name}
                      </span>
                      <span className="text-sm text-muted-foreground break-all sm:ml-2">
                        {account.accountId}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        getAccountProviderId(account) === "siwn"
                          ? handleUnlinkNearAccount(account)
                          : handleUnlinkAccount(account.providerId)
                      }
                      disabled={
                        isUnlinking === accountActionId(account) ||
                        !canUnlinkAccount(account)
                      }
                      className="text-destructive hover:text-destructive"
                    >
                      {isUnlinking === accountActionId(account)
                        ? "Unlinking..."
                        : "Unlink"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Add New Account</h4>
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
                  ? walletAccountId
                    ? "Linking NEAR..."
                    : "Connecting Wallet..."
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

    </div>
  );
}

export function GuestbookCard({ initialGreeting }: { initialGreeting?: string }) {
  const auth = useAuthClient();
  const [newGreeting, setNewGreeting] = useState("");
  const [sendMode, setSendMode] = useState<SendMode>("relay");
  const [relayStatus, setRelayStatus] = useState<RelayStatus>("idle");
  const [relayTxHash, setRelayTxHash] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const network = (auth.near.getState()?.networkId || "mainnet") as "mainnet" | "testnet";
  const queryKey = useMemo(() => getGuestbookGreetingQueryKey(network), [network]);

  const { data: greeting } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await auth.near.view({
        contractId: GUESTBOOK_CONTRACT,
        methodName: "get_greeting",
      });
      const result = res?.data?.result;
      return typeof result === "string" ? result : "";
    },
    initialData: initialGreeting,
  });

  useEffect(() => {
    if (relayStatus !== "pending" || !relayTxHash) return;
    let failures = 0;
    const near = auth.near;
    const interval = setInterval(async () => {
      try {
        const res = await near.getRelayStatus(relayTxHash);
        const status = res.data?.status;
        if (status === "completed" || status === "failed") {
          setRelayStatus(status);
          queryClient.invalidateQueries({ queryKey });
          clearInterval(interval);
        }
      } catch {
        failures++;
        if (failures >= 10) {
          setRelayStatus("failed");
          clearInterval(interval);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [relayStatus, relayTxHash, queryClient, queryKey, auth.near]);

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
      const accountId = auth.near.getAccountId();
      if (!accountId) throw new Error("Not authenticated");
      const signedDelegateAction = await auth.near.buildSignedDelegateAction(
        GUESTBOOK_CONTRACT,
        (builder) =>
          builder.functionCall(
            GUESTBOOK_CONTRACT,
            "set_greeting",
            { greeting: text },
            {
              gas: Gas.Tgas(30),
              attachedDeposit: BigInt(0),
            },
          ),
      );
      const relayResult = await auth.near.relayTransaction({
        payload: signedDelegateAction,
      });
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
      const accountId = auth.near.getAccountId();
      if (!accountId) throw new Error("Not authenticated");
      return auth.near.client
        .transaction(accountId)
        .functionCall(
          GUESTBOOK_CONTRACT,
          "set_greeting",
          { greeting: text },
          {
            gas: Gas.Tgas(30),
            attachedDeposit: BigInt(0),
          },
        )
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
          <CardTitle>Guestbook Demo</CardTitle>
          <div className="flex gap-1">
            <Button
              variant={sendMode === "relay" ? "default" : "outline"}
              size="sm"
              onClick={() => setSendMode("relay")}
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              Gasless
            </Button>
            <Button
              variant={sendMode === "direct" ? "default" : "outline"}
              size="sm"
              onClick={() => setSendMode("direct")}
            >
              <Wallet className="h-3.5 w-3.5 mr-1" />
              Direct
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
          <Input
            placeholder="Leave a message..."
            value={newGreeting}
            onChange={(e) => setNewGreeting(e.target.value)}
            disabled={isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={isPending || !newGreeting.trim()}>
            {isPending ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{sendMode === "relay" ? "Relaying..." : "Sending..."}</span>
              </div>
            ) : (
              "Add"
            )}
          </Button>
        </form>

        {sendMode === "relay" && relayStatus !== "idle" && (
          <div className="flex items-center gap-2 p-3 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/50">
            {relayStatus === "pending" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <span className="text-sm">Submitting to chain...</span>
              </>
            )}
            {relayStatus === "completed" && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">Confirmed on chain</span>
                {relayTxHash && (
                  <a
                    href={explorerTxUrl(relayTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline flex items-center gap-1 ml-1"
                  >
                    <code className="font-mono">{relayTxHash.slice(0, 8)}...</code>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
            {relayStatus === "failed" && (
              <span className="text-sm text-destructive">Relay failed — try direct mode</span>
            )}
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
            <p className="text-sm text-muted-foreground text-center py-4">
              No messages yet. Be the first to leave one!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function RelayFeedCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transaction Feed</CardTitle>
        <CardDescription>Live-updating relay history</CardDescription>
      </CardHeader>
      <CardContent>
        <RelayFeed />
      </CardContent>
    </Card>
  );
}

export function SessionInfoCard({
  session,
  user,
  nearAccountId,
  linkedAccounts,
  privateData,
}: {
  session: SessionData | null | undefined;
  user: any;
  nearAccountId: string | null;
  linkedAccounts: any[];
  privateData: any;
}) {
  const nearAccountCount = linkedAccounts.filter((a) => getAccountProviderId(a) === "siwn").length;
  const oauthAccountCount = linkedAccounts.filter((a) => {
    const providerId = getAccountProviderId(a);
    return providerId !== "siwn" && providerId !== "unknown";
  }).length;
  const providerCount = nearAccountCount + oauthAccountCount;
  const sessionDetails = session?.session as { id?: string; expiresAt?: string | Date } | undefined;
  const sessionId = privateData?.sessionId ?? sessionDetails?.id ?? null;
  const expiresAt = privateData?.expiresAt ?? sessionDetails?.expiresAt ?? null;
  const sessionIdLabel =
    typeof sessionId === "string" && sessionId.length > 0 ? `${sessionId.slice(0, 12)}...` : "N/A";
  const expiresLabel = expiresAt ? new Date(expiresAt).toLocaleString() : "N/A";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Session
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">User</span>
          <span className="font-medium text-right">{user?.name || nearAccountId || "Unknown"}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Email</span>
          <span className="text-xs text-right break-all">{user?.email || "N/A"}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">NEAR Account</span>
          {nearAccountId ? (
            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-right break-all">
              {nearAccountId}
            </code>
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Linked Providers</span>
          <div className="flex gap-1">
            {nearAccountCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {nearAccountCount} NEAR
              </Badge>
            )}
            {oauthAccountCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {oauthAccountCount} OAuth
              </Badge>
            )}
            {providerCount === 0 && <span className="text-xs text-muted-foreground">None</span>}
          </div>
        </div>
        {privateData && (
          <div className="border-t border-border pt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" /> Session ID
              </span>
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                {sessionIdLabel}
              </code>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Expires
              </span>
              <span className="text-xs text-right">{expiresLabel}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function NearProfileSearchCard({ initialAccountId }: { initialAccountId?: string }) {
  const auth = useAuthClient();
  const initialSearchId = initialAccountId?.trim() || "";
  const [searchId, setSearchId] = useState(initialSearchId);
  const [queryId, setQueryId] = useState<string | undefined>(initialSearchId || undefined);

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["near-profile", queryId],
    queryFn: async () => {
      const res = await auth.near.getProfile(queryId);
      return res.data || null;
    },
    enabled: !!queryId,
  });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = searchId.trim();
    if (id) setQueryId(id);
  };

  useEffect(() => {
    setSearchId(initialSearchId);
    setQueryId(initialSearchId || undefined);
  }, [initialSearchId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Profile Explorer
        </CardTitle>
        <CardDescription>Browse NEAR Social profiles by account ID</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSearch} className="flex gap-2">
          <Input
            placeholder="Enter a NEAR account ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!searchId.trim()}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </form>

        {queryId && (
          <div className="space-y-3">
            {isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading profile...
              </div>
            )}
            {error && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Failed to load profile for {queryId}
              </div>
            )}
            {!isLoading && !error && profile && (
              <div className="space-y-3">
                <NearProfile accountId={queryId} variant="card" showAvatar showName />
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/account/$accountId"
                    params={{ accountId: queryId }}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open profile route
                  </Link>
                  <a
                    href={`https://near.social/${queryId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View on NEAR Social
                  </a>
                </div>
              </div>
            )}
            {!isLoading && !error && !profile && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No NEAR Social profile found for{" "}
                <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{queryId}</code>
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

export function useWorkspaceData(session: SessionData | null | undefined) {
  const nearAccountsQuery = useNearAccountsData(!!session?.user);
  const organizationsQuery = useOrganizationsData();
  const privateDataQuery = usePrivateData(!!session?.user);
  const greetingQuery = useGuestbookGreeting(!!session?.user);
  const relayerQuery = useRelayerInfo();
  const nearAccountsData = nearAccountsQuery.data ?? { accounts: [] };
  const linkedAccounts = nearAccountsData.accounts;
  const nearAccountId = getActiveNearAccountId(nearAccountsData);
  const linkedProviders = getLinkedNearProviders(linkedAccounts);

  return {
    linkedAccounts,
    nearAccountId,
    linkedProviders,
    organizations: organizationsQuery.data ?? [],
    privateData: privateDataQuery.data,
    greeting: greetingQuery.data,
    relayerData: relayerQuery.data,
  };
}

export function useSessionData() {
  const auth = useAuthClient();
  return useQuery<SessionData | null>(sessionQueryOptions(auth));
}
