import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import type { RelayedTransactionT } from "better-near-auth";

export function useNearAccounts(session: any) {
  return useQuery({
    queryKey: ["near-accounts"],
    queryFn: async () => {
      const res = await authClient.near.listAccounts();
      const accounts = res?.data?.accounts;
      return Array.isArray(accounts) ? accounts : [];
    },
    enabled: !!session,
  });
}

export function useRelayHistory(session: any) {
  return useQuery({
    queryKey: ["relay-history"],
    queryFn: async () => {
      const res = await authClient.near.relayHistory();
      if (res.error) {
        console.error("relayHistory error:", res.error);
      }
      const txs = res?.data?.transactions ?? [];
      return txs as RelayedTransactionT[];
    },
    enabled: !!session,
    refetchInterval: 2000,
  });
}
