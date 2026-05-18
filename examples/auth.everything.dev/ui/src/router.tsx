import { createBrowserHistory, createRouter as createTanStackRouter } from "@tanstack/react-router";
import { createAuthClient } from "./app";
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
    basepath: opts.basepath ?? opts.context.runtimeConfig?.runtime?.runtimeBasePath ?? "/",
    context: {
      queryClient,
      assetsUrl: opts.context.assetsUrl,
      runtimeConfig: opts.context.runtimeConfig,
      apiClient: opts.context.apiClient,
      authClient: opts.context.authClient ?? createAuthClient(opts.context.runtimeConfig),
      session: opts.context.session,
    },
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultStructuralSharing: true,
    defaultPreloadStaleTime: 30_000,
    defaultPendingMinMs: 200,
    defaultPendingComponent: () => (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    ),
  });

  return { router, queryClient };
}

export { routeTree };

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>["router"];
  }
}
