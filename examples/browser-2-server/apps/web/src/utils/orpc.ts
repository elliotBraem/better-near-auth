import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { toast } from "sonner";
import type { AppRouter } from "../../../server/src/routers";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: () => {
            queryClient.invalidateQueries();
          },
        },
      });
    },
  }),
  defaultOptions: { queries: { staleTime: 60 * 1000 } },
});

const getServerUrl = () => {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl) {
    return envUrl;
  }
  // Default to localhost:3000 for development
  return import.meta.env.DEV ? "http://localhost:3000" : "";
};

const serverUrl = getServerUrl();
if (!serverUrl) {
  throw new Error(
    "VITE_SERVER_URL is not set. Please set it in your .env file or environment variables."
  );
}

const link = new RPCLink({
  url: `${serverUrl}/rpc`,
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  },
});

export const client: RouterClient<AppRouter> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
