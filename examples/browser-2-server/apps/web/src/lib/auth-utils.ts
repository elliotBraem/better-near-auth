/**
 * Extract NEAR accountId from linked accounts
 */
export function getNearAccountId(linkedAccounts: any[]): string | null {
  const nearAccount = linkedAccounts.find(account => account.providerId === 'siwn');
  return (nearAccount?.accountId)?.split(":")[0] || nearAccount?.providerId || null;
}

/**
 * Get all linked provider names
 */
export function getLinkedProviders(linkedAccounts: any[]): string[] {
  return linkedAccounts.map(account => account.providerId);
}

/**
 * Update account linking component state after OAuth link
 */
export function handleAccountLinkRefresh(componentState: any, setLinkedAccounts: React.Dispatch<React.SetStateAction<any[]>>, refreshAccounts: () => Promise<void>) {
  // Call refresh immediately and also set up interval to catch delayed callbacks
  refreshAccounts();

  // Some OAuth providers have delayed callbacks, refresh again after redirects
  const urlParams = new URLSearchParams(window.location.search);
  const hasCallback = urlParams.has('code') || urlParams.has('state') || urlParams.has('callbackUrl');

  if (hasCallback) {
    // Clean up URL params if we're still here
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState(null, '', cleanUrl);

    // Refresh accounts after a short delay to catch any linking
    setTimeout(() => {
      refreshAccounts();
    }, 1000);
  }

  return refreshAccounts;
}

/**
 * Get provider display configuration
 */
export function getProviderConfig(provider: string) {
  switch (provider) {
    case 'google':
      return {
        name: 'Google',
        icon: '🔵',
        color: 'text-white',
        backgroundColor: 'bg-[#4285F4]'
      };
    case 'github':
      return {
        name: 'GitHub',
        icon: '⚫',
        color: 'text-white',
        backgroundColor: 'bg-[#181717]'
      };
    case 'siwn':
      return {
        name: 'NEAR',
        icon: '🔗',
        color: 'text-white',
        backgroundColor: 'bg-[#000000]'
      };
    default:
      return {
        name: provider?.charAt(0).toUpperCase() + provider?.slice(1) || "Unknown",
        icon: '🔗',
        color: 'text-muted-foreground',
        backgroundColor: 'bg-gray-100'
      };
  }
}
