/**
 * Extract NEAR accountId from linked accounts
 */
export function getNearAccountId(linkedAccounts: any[]): string | null {
  if (!Array.isArray(linkedAccounts)) {
    return null;
  }
  const nearAccount = linkedAccounts.find((account) => account.providerId === "siwn");
  return nearAccount?.accountId?.split(":")[0] || nearAccount?.providerId || null;
}

/**
 * Get all linked provider names
 */
export function getLinkedProviders(linkedAccounts: any[]): string[] {
  if (!Array.isArray(linkedAccounts)) {
    return [];
  }
  return linkedAccounts.map((account) => account.providerId);
}

/**
 * Get provider display configuration
 */
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
