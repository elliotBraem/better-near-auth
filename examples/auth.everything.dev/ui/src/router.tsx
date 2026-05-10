import { createBrowserHistory, createRouter as createTanStackRouter } from "@tanstack/react-router";
import { getRuntimeBasePath } from "./app";
import { routeTree } from "./routeTree.gen";
import "./styles.css";
import type { CreateRouterOptions } from "./app";

export type {
  ClientRuntimeConfig,
  CreateRouterOptions,
  RouterContext,
  RouterModule,
} from "./app";

export function createRouter(opts: CreateRouterOptions) {
  const queryClient = opts.context.queryClient;
  const history = opts.history ?? createBrowserHistory();

  const router = createTanStackRouter({
    routeTree,
    history,
    basepath: opts.basepath ?? getRuntimeBasePath(opts.context.runtimeConfig),
    context: {
      queryClient,
      assetsUrl: opts.context.assetsUrl,
      runtimeConfig: opts.context.runtimeConfig,
      apiClient: opts.context.apiClient,
      authClient: opts.context.authClient,
      session: opts.context.session,
    },
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultStructuralSharing: true,
    defaultPreloadStaleTime: 0,
    defaultPendingMinMs: 0,
  });

  return { router, queryClient };
}

export { routeTree };

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>["router"];
  }
}
