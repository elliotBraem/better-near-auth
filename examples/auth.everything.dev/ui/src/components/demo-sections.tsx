import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import type { ListedNearAccount } from "better-near-auth";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Focus,
  Globe,
  Key,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlink,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { Gas, generateKey } from "near-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type Organization,
  type PrivateData,
  type RelayerData,
  type SessionData,
  sessionQueryOptions,
  useApiClient,
  useAuthClient,
} from "@/app";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components";
import { Input } from "@/components/ui/input";
import { getLinkedProviders, getNearAccountId, getProviderConfig } from "@/lib/auth-utils";
import { NearProfile } from "./near-profile";
import RelayFeed from "./relay-feed";

const GUESTBOOK_CONTRACT = "hello.near-examples.near";
type SendMode = "relay" | "direct";
type RelayStatus = "idle" | "pending" | "completed" | "failed";
type AuthUser = NonNullable<SessionData["user"]> | null;
type LinkingProvider = "google" | "github" | "near";
type CreationState =
  | { phase: "idle" }
  | { phase: "creating" }
  | { phase: "created"; accountId: string; network: string };

const NEO_BORDER = "border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)]";
const NEO_BORDER_DASHED =
  "border-2 border-dashed border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)]";
const NEO_BORDER_DESTRUCTIVE =
  "border-2 border-dashed border-[rgb(180,50,40)] dark:border-[rgb(200,80,70)]";
const NEO_BORDER_THIN = "border border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)]";

function explorerTxUrl(txHash: string) {
  return `https://near.rocks/tx/${txHash}`;
}

function formatNearDisplay(balance: string): string {
  if (!balance?.trim()) return "0";
  const trimmed = balance.trim();
  const near = /^\d+$/.test(trimmed)
    ? Number(trimmed) / 1e24
    : Number.parseFloat(trimmed);
  if (!Number.isFinite(near)) return trimmed;
  if (near >= 1) return near.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (near > 0) return near.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return "0";
}

function hasPositiveNearBalance(balance?: string): boolean {
  if (!balance?.trim()) return false;
  const trimmed = balance.trim();
  try {
    if (/^\d+$/.test(trimmed)) {
      return BigInt(trimmed) > 0n;
    }
    const near = Number.parseFloat(trimmed);
    return Number.isFinite(near) && near > 0;
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

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function unlinkNearAccount(
  auth: ReturnType<typeof useAuthClient>,
  account: ListedNearAccount,
) {
  const [accountId] = account.accountId.split(":");
  return auth.near.unlink({
    accountId,
    network: account.network,
  });
}

export function getActiveNearAccountId(data: { accounts: ListedNearAccount[] }) {
  return getNearAccountId(data.accounts);
}

export function useNearAccountsData(enabled = true) {
  const auth = useAuthClient();

  return useQuery({
    queryKey: ["near-accounts"],
    queryFn: async () => {
      const res = await auth.near.listAccounts();
      return res.data ?? { accounts: [], activeAccount: null, availableAccounts: [] };
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

  return useQuery<PrivateData>({
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
      const response = await auth.near.getRelayerInfo({});
      return response.data as RelayerData;
    },
  });
}

export function useGuestbookGreeting(enabled = true) {
  const auth = useAuthClient();
  const network = auth.useActiveNetwork();

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
    <div className={`${NEO_BORDER} p-4 bg-card`}>
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
  user: AuthUser;
  nearAccountId: string | null;
  linkedProviders: string[];
  linkedAccounts: ListedNearAccount[];
}) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const [isUnlinking, setIsUnlinking] = useState(false);
  const displayName = user?.name || nearAccountId || "User";
  const displayEmail = user?.email;
  const initial = displayName?.charAt(0).toUpperCase();
  const currentNearAccount = linkedAccounts.find(
    (account) =>
      account.providerId === "siwn" && account.accountId?.split(":")[0] === nearAccountId,
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
                  if (!canUnlinkNearAccount || !currentNearAccount) return;
                  setIsUnlinking(true);
                  try {
                    const response = await unlinkNearAccount(auth, currentNearAccount);
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
  const { data, isLoading, isFetching, refetch } = useRelayerInfo();

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

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

  const isFunded = hasPositiveNearBalance(data.balance) || hasPositiveNearBalance(data.available);
  const statusLabel = isFunded ? "Active" : "Unfunded";
  const statusColor = isFunded ? "bg-green-500" : "bg-amber-500";

  return (
    <Card>
      <CardHeader className="grid grid-cols-[1fr_auto] items-center gap-2">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Relayer
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refetch()}
            disabled={isFetching}
            title="Refresh balance"
            aria-label="Refresh relayer balance"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
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
              onClick={() => handleCopy(data.accountId)}
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
          <div className={`${NEO_BORDER} p-3`}>
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-sm font-medium">{formatNearDisplay(data.balance ?? "0")} NEAR</div>
          </div>
          <div className={`${NEO_BORDER} p-3`}>
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="text-sm font-medium">{formatNearDisplay(data.available ?? "0")} NEAR</div>
          </div>
        </div>

        {!isFunded && (
          <div className={`${NEO_BORDER_DASHED} rounded-lg p-4 text-center space-y-2`}>
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

export function AccountLinkingCard({
  linkedAccounts,
  user,
}: {
  linkedAccounts: ListedNearAccount[];
  user: AuthUser;
}) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [linkingProvider, setLinkingProvider] = useState<LinkingProvider | null>(null);
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);
  const [recentlyLinked, setRecentlyLinked] = useState<{
    provider: string;
    accountId: string;
  } | null>(null);

  useEffect(() => {
    if (!recentlyLinked) return;
    const timer = setTimeout(() => setRecentlyLinked(null), 5000);
    return () => clearTimeout(timer);
  }, [recentlyLinked]);

  const isAnonymous = user?.isAnonymous ?? false;
  const walletAccountId = auth.near.getAccountId();
  const accounts = linkedAccounts;

  const invalidateAccounts = () => {
    void queryClient.invalidateQueries({ queryKey: ["near-accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["session"] });
    void router.invalidate();
  };

  const handleLinkSocial = async (providerId: "google" | "github") => {
    setLinkingProvider(providerId);
    try {
      await auth.linkSocial({
        provider: providerId,
        callbackURL: window.location.href,
      });
      toast.success(`${providerId === "google" ? "Google" : "GitHub"} account linked successfully`);
      invalidateAccounts();
      setRecentlyLinked({ provider: providerId, accountId: providerId });
    } catch (error) {
      console.error(`Failed to link ${providerId}:`, error);
      toast.error(`Failed to link ${providerId === "google" ? "Google" : "GitHub"} account`);
    } finally {
      setLinkingProvider(null);
    }
  };

  const handleNearAction = async () => {
    setLinkingProvider("near");
    try {
      await auth.near.link({
        onSuccess: () => {
          const linkedAccountId = walletAccountId || "NEAR account";
          toast.success(
            `NEAR account "${linkedAccountId}" linked successfully${isAnonymous ? " — your session is now persistent" : ""}`,
          );
          invalidateAccounts();
          setLinkingProvider(null);
          setRecentlyLinked({ provider: "siwn", accountId: linkedAccountId });
        },
        onError: async (error) => {
          console.error("NEAR link error:", error);
          const errorMessage =
            error.code === "SIGNER_NOT_AVAILABLE"
              ? "NEAR wallet not available"
              : error.message || "Failed to link NEAR account";
          toast.error(errorMessage);
          setLinkingProvider(null);
          await auth.near.disconnect();
        },
      });
    } catch (error) {
      console.error("Failed to process NEAR action:", error);
      setLinkingProvider(null);
      toast.error("Failed to process NEAR action");
    }
  };

  const handleUnlinkNearAccount = async (account: ListedNearAccount) => {
    setIsUnlinking(account.accountId);
    try {
      const response = await unlinkNearAccount(auth, account);
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
    accounts.some(
      (a) => a.providerId === providerId || (a.providerId === "siwn" && providerId === "siwn"),
    );
  const canUnlinkAccount = (account: ListedNearAccount) =>
    account !== primaryAccount && accounts.length > 1;
  const accountKey = (account: ListedNearAccount) =>
    `${account.providerId}:${account.network}:${account.accountId}`;
  const accountActionId = (account: ListedNearAccount) =>
    account.providerId === "siwn" ? account.accountId : account.providerId || "unknown";

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
            <div
              className={`${NEO_BORDER_DESTRUCTIVE} bg-destructive/5 p-3 text-sm text-muted-foreground`}
            >
              <strong className="text-foreground">Temporary session.</strong> Link an account to
              make your data persistent and recoverable.
            </div>
          )}

          {recentlyLinked && (
            <div className={`${NEO_BORDER} bg-green-50 dark:bg-green-900/20 p-3 text-sm`}>
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
              <div
                className={`flex flex-col gap-3 p-3 ${NEO_BORDER} bg-muted/30 sm:flex-row sm:items-center sm:justify-between`}
              >
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <span className="text-lg">
                    {getProviderConfig(primaryAccount.providerId).icon}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium block sm:inline">
                      {getProviderConfig(primaryAccount.providerId).name}
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
                  className={`flex flex-col gap-3 p-3 ${NEO_BORDER} sm:flex-row sm:items-center sm:justify-between`}
                >
                  <div className="flex min-w-0 items-start gap-3 sm:items-center">
                    <span className="text-lg">{getProviderConfig(account.providerId).icon}</span>
                    <div className="min-w-0">
                      <span className="font-medium block sm:inline">
                        {getProviderConfig(account.providerId).name}
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
                        account.providerId === "siwn"
                          ? handleUnlinkNearAccount(account)
                          : handleUnlinkAccount(account.providerId)
                      }
                      disabled={
                        isUnlinking === accountActionId(account) || !canUnlinkAccount(account)
                      }
                      className="text-destructive hover:text-destructive"
                    >
                      {isUnlinking === accountActionId(account) ? "Unlinking..." : "Unlink"}
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
                disabled={linkingProvider === "google"}
              >
                <span className="mr-2">🔵</span>
                {linkingProvider === "google" ? "Linking Google..." : "Link Google Account"}
              </Button>
            )}
            {!isProviderLinked("github") && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleLinkSocial("github")}
                disabled={linkingProvider === "github"}
              >
                <span className="mr-2">⚫</span>
                {linkingProvider === "github" ? "Linking GitHub..." : "Link GitHub Account"}
              </Button>
            )}
            {!isProviderLinked("siwn") && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={handleNearAction}
                disabled={linkingProvider === "near"}
              >
                <span className="mr-2">🔗</span>
                {linkingProvider === "near"
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
  const { data: nearAccountsData } = useNearAccountsData(!!auth.near.getAccountId());
  const [newGreeting, setNewGreeting] = useState("");
  const [sendMode, setSendMode] = useState<SendMode>("relay");
  const [relayStatus, setRelayStatus] = useState<RelayStatus>("idle");
  const [relayTxHash, setRelayTxHash] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const hasLinkedNear = Boolean(getActiveNearAccountId(nearAccountsData ?? { accounts: [] }));
  const canSignGuestbook = hasLinkedNear;

  const network = auth.useActiveNetwork();
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

  const { data: relayPollStatus } = useQuery({
    queryKey: ["relay-status", relayTxHash],
    queryFn: async () => {
      if (!relayTxHash) return null;
      const res = await auth.near.getRelayStatus(relayTxHash);
      return res.data?.status;
    },
    enabled: relayStatus === "pending" && !!relayTxHash,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (relayPollStatus === "completed" || relayPollStatus === "failed") {
      setRelayStatus(relayPollStatus);
      queryClient.invalidateQueries({ queryKey });
    }
  }, [relayPollStatus, queryClient, queryKey]);

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
    if (!canSignGuestbook || !auth.near.getAccountId()) {
      toast.error("Please connect a NEAR account");
      return;
    }
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
            placeholder={canSignGuestbook ? "Leave a message..." : "Connect a NEAR account to sign..."}
            value={newGreeting}
            onChange={(e) => setNewGreeting(e.target.value)}
            disabled={isPending || !canSignGuestbook}
            className="flex-1"
          />
          <Button type="submit" disabled={isPending || !newGreeting.trim() || !canSignGuestbook}>
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

        {!canSignGuestbook && (
          <p className="text-sm text-muted-foreground">
            Please{" "}
            <Link to="/accounts" className="text-foreground underline underline-offset-4">
              connect a NEAR account
            </Link>{" "}
            to sign the guestbook.
          </p>
        )}

        {sendMode === "relay" && relayStatus !== "idle" && (
          <div className={`flex items-center gap-2 p-3 ${NEO_BORDER} bg-muted/50`}>
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
  session: _session,
  user,
  nearAccountId,
  linkedAccounts,
  privateData,
}: {
  session: SessionData | null | undefined;
  user: AuthUser;
  nearAccountId: string | null;
  linkedAccounts: ListedNearAccount[];
  privateData: PrivateData | null | undefined;
}) {
  const nearAccountCount = linkedAccounts.filter((a) => a.providerId === "siwn").length;
  const oauthAccountCount = linkedAccounts.filter((a) => {
    const pid = a.providerId;
    return pid !== "siwn" && pid !== "unknown";
  }).length;
  const providerCount = nearAccountCount + oauthAccountCount;
  

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
                <Key className="h-3.5 w-3.5" /> User ID
              </span>
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                {privateData.userId ?? "N/A"}
              </code>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Organization
              </span>
              <span className="text-xs text-right">{privateData.organizationId ?? "N/A"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" /> API Key
              </span>
              <span className="text-xs text-right">{privateData.apiKeyId ?? "N/A"}</span>
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
  const linkedAccounts = nearAccountsQuery.data?.accounts ?? [];
  const nearAccountId = getNearAccountId(linkedAccounts);
  const linkedProviders = getLinkedProviders(linkedAccounts);

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

export function NetworkToggle() {
  const auth = useAuthClient();
  const supportedNetworks = auth.near.getSupportedNetworks();
  const currentNetwork = auth.useActiveNetwork();

  if (supportedNetworks.length <= 1) return null;

  return (
    <div className={`flex items-center gap-2 p-1 ${NEO_BORDER} rounded-lg bg-muted/30`}>
      {supportedNetworks.map((network) => (
        <button
          type="button"
          key={network}
          onClick={() => {
            auth.near.setNetwork(network);
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            currentNetwork === network
              ? `bg-background text-foreground shadow-sm ${NEO_BORDER_THIN}`
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            {network === "mainnet" ? "Mainnet" : "Testnet"}
          </span>
        </button>
      ))}
    </div>
  );
}

export function SubAccountCreationCard() {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const network = auth.useActiveNetwork();
  const [subAccountName, setSubAccountName] = useState("");
  const [creationState, setCreationState] = useState<CreationState>({ phase: "idle" });
  const privateKeyRef = useRef<string | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  const { data: relayerData } = useRelayerInfo();
  const hasRelayer = relayerData?.enabled === true;
  const canCreateSubAccount = relayerData?.subAccountAvailable === true;

  const parentAccount = relayerData?.parentAccount;
  const parentSuffix = parentAccount ? `.${parentAccount}` : "";
  const fullAccountId = subAccountName ? `${subAccountName}${parentSuffix}` : "";

  const isValidName = /^[a-z0-9]+$/.test(subAccountName) && subAccountName.length >= 1;

  const debouncedSubAccountName = useDebouncedValue(subAccountName, 300);

  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: ["sub-account-availability", debouncedSubAccountName, network],
    queryFn: async () => {
      if (!debouncedSubAccountName || debouncedSubAccountName.length < 1) return null;
      const res = await auth.near.checkSubAccountAvailability({
        subAccountName: debouncedSubAccountName,
        network,
      });
      return res.data;
    },
    enabled: isValidName && debouncedSubAccountName.length >= 1,
    placeholderData: (prev) => prev,
  });

  const isAvailable = availability?.available === true;

  const handleCreate = async () => {
    if (!subAccountName.trim()) return;

    setCreationState({ phase: "creating" });
    try {
      const keyPair = generateKey();
      const publicKey = keyPair.publicKey.toString();

      const result = await auth.near.createSubAccount({
        subAccountName: subAccountName.trim().toLowerCase(),
        network,
        publicKey,
      });

      if (result.error) {
        throw new Error(result.error.message || "Failed to create sub-account");
      }

      if (result.data?.success) {
        privateKeyRef.current = keyPair.secretKey;
        setCreationState({
          phase: "created",
          accountId: result.data.accountId,
          network: result.data.network,
        });
        toast.success(`Sub-account ${result.data.accountId} created on ${result.data.network}`);
        await queryClient.invalidateQueries({ queryKey: ["near-accounts"] });
        setSubAccountName("");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create sub-account";
      toast.error(msg);
      setCreationState({ phase: "idle" });
    }
  };

  if (!hasRelayer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Create Sub-account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sub-account creation requires a funded relayer. Configure the relayer on your server to
            enable this feature.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canCreateSubAccount) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Create Sub-account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sub-account creation requires a named parent account. Configure{" "}
            <code className="text-xs font-mono bg-muted px-1 rounded">subAccount.parentAccount</code>{" "}
            in your SIWN plugin options, or use an explicit relayer with a named account instead of an
            ephemeral one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Create Sub-account
        </CardTitle>
        <CardDescription>
          Create a new NEAR sub-account under{" "}
          <code className="text-xs font-mono bg-muted px-1 rounded">
            {parentAccount}
          </code>{" "}
          on{" "}
          <Badge variant="outline" className="text-xs">
            {network}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {creationState.phase === "created" ? (
          <div className="space-y-3">
            <div className={`${NEO_BORDER} bg-green-50 dark:bg-green-900/20 p-3 text-sm space-y-2`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="font-medium">Sub-account created!</span>
              </div>
              <div className="space-y-1 pl-6">
                <div className="font-mono text-xs break-all">{creationState.accountId}</div>
                <div className="text-xs text-muted-foreground">
                  Network: {creationState.network}
                </div>
              </div>
            </div>

            {privateKeyRef.current && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Private Key
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={async () => {
                        if (privateKeyRef.current) {
                          await navigator.clipboard.writeText(privateKeyRef.current);
                          toast.success("Private key copied to clipboard");
                        }
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                    >
                      {showPrivateKey ? "Hide" : "Show"}
                    </Button>
                  </div>
                </div>
                {showPrivateKey && (
                  <div className={`${NEO_BORDER_DASHED} rounded-lg p-3 space-y-2`}>
                    <p className="text-xs text-destructive font-medium">
                      Save this key securely. It will not be shown again.
                    </p>
                    <code className="text-xs font-mono break-all block bg-muted p-2 rounded select-all">
                      {privateKeyRef.current}
                    </code>
                  </div>
                )}
              </div>
            )}

            {confirmDismiss ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  Are you sure? The private key will no longer be accessible.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      privateKeyRef.current = null;
                      setCreationState({ phase: "idle" });
                      setShowPrivateKey(false);
                      setConfirmDismiss(false);
                    }}
                  >
                    Dismiss
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmDismiss(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (privateKeyRef.current && !showPrivateKey) {
                    setConfirmDismiss(true);
                  } else {
                    privateKeyRef.current = null;
                    setCreationState({ phase: "idle" });
                    setShowPrivateKey(false);
                  }
                }}
              >
                Create Another
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={subAccountName}
                  onChange={(e) =>
                    setSubAccountName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
                  }
                  placeholder="mysubaccount"
                  disabled={creationState.phase === "creating"}
                  className="flex-1"
                  maxLength={64}
                />
                <Button
                  onClick={handleCreate}
                  disabled={
                    !isValidName ||
                    !isAvailable ||
                    creationState.phase === "creating" ||
                    availabilityLoading
                  }
                >
                  {creationState.phase === "creating" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
              {fullAccountId && (
                <div className="text-xs text-muted-foreground font-mono">{fullAccountId}</div>
              )}
              {subAccountName && !isValidName && (
                <p className="text-xs text-destructive">
                  Only lowercase letters and numbers are allowed
                </p>
              )}
              {availabilityLoading && subAccountName && (
                <p className="text-xs text-muted-foreground">Checking availability...</p>
              )}
              {!availabilityLoading && availability && !availability.available && (
                <p className="text-xs text-destructive">
                  Account <code className="font-mono">{availability.accountId}</code> is already
                  taken
                </p>
              )}
              {!availabilityLoading && availability?.available && subAccountName && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  <code className="font-mono">{availability.accountId}</code> is available!
                </p>
              )}
            </div>
            <div
              className={`${NEO_BORDER_DASHED} rounded-lg p-3 text-xs text-muted-foreground space-y-1`}
            >
              <p>
                A new keypair is generated in your browser. The private key will be shown once after
                creation — save it securely.
              </p>
              <p>
                A minimum deposit of 0.1 NEAR will be transferred from the relayer to fund the new
                account.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
