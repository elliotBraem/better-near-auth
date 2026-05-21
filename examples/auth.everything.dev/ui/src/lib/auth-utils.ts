import type { ListedNearAccount } from "better-near-auth";

export function getProviderId(account: ListedNearAccount): string {
  if (typeof account.providerId === "string" && account.providerId.length > 0) {
    return account.providerId;
  }

  if (
    typeof account.accountId === "string" &&
    (account.network === "mainnet" || account.network === "testnet")
  ) {
    return "siwn";
  }

  return "unknown";
}

export function getNearAccountId(linkedAccounts: ListedNearAccount[]): string | null {
  if (!Array.isArray(linkedAccounts)) {
    return null;
  }
  const nearAccount = linkedAccounts.find((account) => getProviderId(account) === "siwn");
  return nearAccount?.accountId?.split(":")[0] || null;
}

export function getLinkedProviders(linkedAccounts: ListedNearAccount[]): string[] {
  if (!Array.isArray(linkedAccounts)) {
    return [];
  }
  return linkedAccounts.map((account) => getProviderId(account));
}

export function getProviderConfig(provider: string) {
  switch (provider) {
    case "google":
      return {
        name: "Google",
        icon: "🔵",
      };
    case "github":
      return {
        name: "GitHub",
        icon: "⚫",
      };
    case "siwn":
      return {
        name: "NEAR",
        icon: "🔗",
      };
    default:
      return {
        name: provider?.charAt(0).toUpperCase() + provider?.slice(1) || "Unknown",
        icon: "🔗",
      };
  }
}
