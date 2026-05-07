import { getAuthClient, type SessionData } from "@/app";

export const sessionQueryKey = ["session"] as const;

export const sessionQueryOptions = (initialSession?: SessionData | null) => ({
  queryKey: sessionQueryKey,
  queryFn: async () => {
    const { data: session } = await getAuthClient().getSession();
    return session ?? null;
  },
  staleTime: 60 * 1000,
  gcTime: 10 * 60 * 1000,
  initialData: initialSession,
});
