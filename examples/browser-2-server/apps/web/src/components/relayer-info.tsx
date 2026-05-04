import { authClient } from "@/lib/auth-client";
import { useState, useEffect, useCallback } from "react";
import { Copy, Check, ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "./ui/card";

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

function explorerUrl(accountId: string, network: string): string {
  return network === "testnet"
    ? `https://explorer.testnet.near.org/accounts/${accountId}`
    : `https://explorer.near.org/accounts/${accountId}`;
}

export default function RelayerInfo() {
  const [data, setData] = useState<RelayerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchRelayerInfo = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authClient.near.getRelayerInfo();
      if (response.data) {
        setData(response.data as RelayerData);
      }
    } catch (error) {
      console.error("Failed to fetch relayer info:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRelayerInfo();
  }, [fetchRelayerInfo]);

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
          <CardDescription>Gasless transaction relayer</CardDescription>
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
          <p className="text-sm text-muted-foreground">Relayer not configured</p>
        </CardContent>
      </Card>
    );
  }

  const isFunded = data.balance !== "0" && data.balance !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Relayer
        </CardTitle>
        <CardDescription>Gasless transaction relayer</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon" onClick={fetchRelayerInfo} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account ID */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account</span>
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
                href={explorerUrl(data.accountId, data.network ?? "mainnet")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Mode & Network */}
        <div className="flex gap-2">
          <Badge variant={data.mode === "explicit" ? "default" : "secondary"}>
            {data.mode === "explicit" ? "Explicit" : "Ephemeral"}
          </Badge>
          <Badge variant="outline">{data.network}</Badge>
        </div>

        {/* Balance */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Balance</span>
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
          {(data.staked !== "0" && data.staked !== undefined) && (
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">Staked</div>
              <div className="text-sm font-medium">{formatNear(data.staked)} NEAR</div>
            </div>
          )}
        </div>

        {/* Storage */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Storage</span>
          <span>{data.storageBytes ? `${(data.storageBytes / 1024).toFixed(1)} KB` : "0 KB"}</span>
        </div>

        {/* Fund prompt */}
        {!isFunded && (
          <div className="border border-dashed rounded-lg p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Fund this account to enable gasless relay</p>
            <code className="text-xs font-mono break-all select-all bg-muted px-2 py-1 rounded block">
              {data.accountId}
            </code>
          </div>
        )}

        {/* Timestamps */}
        {(data.createdAt || data.lastUsedAt) && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {data.createdAt && (
              <div>Created: {new Date(data.createdAt).toLocaleDateString()}</div>
            )}
            {data.lastUsedAt && (
              <div>Last used: {new Date(data.lastUsedAt).toLocaleDateString()}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
