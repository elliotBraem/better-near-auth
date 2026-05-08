import { useQuery } from "@tanstack/react-query";
import type { RelayedTransactionT } from "better-near-auth";
import { getAuthClient } from "@/app";

export function useRelayHistory(session: any) {
  return useQuery({
    queryKey: ["relay-history"],
    queryFn: async () => {
      const res = await getAuthClient().near.relayHistory();
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
