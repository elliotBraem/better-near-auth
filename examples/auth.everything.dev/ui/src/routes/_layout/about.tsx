import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getActiveRuntime, getAppName } from "@/app";
import { Badge, Card, CardContent, UnderConstruction } from "@/components";
import { useApiClient } from "@/lib/use-api-client";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/_layout/about")({
  head: () => ({
    meta: [
      { title: "About | app" },
      {
        name: "description",
        content:
          "app is a runtime-composed site on NEAR where published config defines how host, UI, and API load together.",
      },
    ],
  }),
  component: About,
});

function About() {
  const apiClient = useApiClient();
  const { runtimeConfig } = RootRoute.useLoaderData();
  const appName = getAppName(runtimeConfig);
  const activeRuntime = getActiveRuntime(runtimeConfig);
  const registryAccountId = activeRuntime?.accountId ?? "every.near";
  const registryGatewayId = activeRuntime?.gatewayId ?? "everything.dev";
  const configQuery = useQuery({
    queryKey: ["registry-app", registryAccountId, registryGatewayId],
    queryFn: () =>
      apiClient.registry.getRegistryApp({
        accountId: registryAccountId,
        gatewayId: registryGatewayId,
      }),
    staleTime: 5 * 60_000,
  });

  const resolvedConfig = configQuery.data?.data?.resolvedConfig;

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <Link
          to="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
        >
          &larr; back home
        </Link>
        <div className="space-y-4 max-w-3xl">
          <Badge variant="outline">about</Badge>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Runtime composition, published in public
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            <strong className="text-foreground">{appName}</strong> is a runtime-composed site on{" "}
            <a
              href="https://near.org"
              className="underline hover:text-foreground transition-colors"
            >
              NEAR
            </a>
            . A published <code>bos.config.json</code> record defines how the host, UI, and API fit
            together, and the running site is built from that composition instead of a single fixed
            bundle.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            The goal is not only to browse apps, but to make software easier to inspect, reuse, and
            keep building over. The same host can support multiple sites, while each published
            config can point at its own remotes, plugins, and interfaces.
          </p>
          <UnderConstruction
            label="about"
            sourceFile="ui/src/routes/_layout/about.tsx"
            className="w-full max-w-sm mt-3"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              how it works
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                1. discover the published runtime record from the FastKV registry on{" "}
                <a
                  href="https://near.org"
                  className="underline hover:text-foreground transition-colors"
                >
                  NEAR
                </a>
              </p>
              <p>
                2. resolve the effective config, including inherited <code>bos://</code> values
              </p>
              <p>
                3. load the UI through{" "}
                <a
                  href="https://module-federation.io/"
                  className="underline hover:text-foreground transition-colors"
                >
                  Module Federation
                </a>{" "}
                and the API through{" "}
                <a
                  href="https://github.com/near-everything/every-plugin"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground transition-colors font-mono"
                >
                  every-plugin
                </a>
              </p>
              <p>
                4. layer public metadata and tooling around the canonical runtime without replacing
                it
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">start here</div>
            <div className="grid gap-3">
              <BoxLink
                href="/apps"
                title="browse published apps"
                body="inspect accounts, gateways, remotes, and public runtime metadata"
              />
              <BoxLink
                href="/README.md"
                title="read the public overview"
                body={`human-readable context for what ${appName} is and how it is composed`}
              />
              <BoxLink
                href="/skill.md"
                title="open the agent guide"
                body="task-oriented notes for agents, crawlers, and AI-native clients"
              />
              <BoxLink
                href="/opencode"
                title="build with opencode"
                body="set up an AI dev loop — edit pages, see changes live, use authClient and apiClient"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {resolvedConfig && (
        <section className="space-y-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            canonical runtime record
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">
            This is the live resolved <code>bos.config.json</code> for{" "}
            <code>
              {registryAccountId}/{registryGatewayId}
            </code>
            , fetched from the FastKV-backed public registry and merged with any inherited values.
          </p>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <pre className="overflow-x-auto text-xs leading-relaxed text-muted-foreground font-mono whitespace-pre">
                {JSON.stringify(resolvedConfig, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <FactCard
          title="canonical runtime"
          body="The published bos.config.json stays the source of truth for runtime composition. Other metadata can help describe the app, but it does not replace how the system boots."
        />
        <FactCard
          title="runtime-loaded product"
          body={
            <>
              The host acts as the shell, loading the UI at runtime through Module Federation and
              the API through{" "}
              <a
                href="https://github.com/near-everything/every-plugin"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground transition-colors font-mono"
              >
                every-plugin
              </a>
              , so each part can evolve independently.
            </>
          }
        />
        <FactCard
          title="shared host, different sites"
          body="Multiple sites can share the same stable host configuration while publishing different runtime records that point to different remotes, plugins, and product surfaces."
        />
        <FactCard
          title="AI-friendly surface"
          body={
            <>
              Public files such as{" "}
              <a
                href="/README.md"
                className="underline hover:text-foreground transition-colors font-mono"
              >
                /README.md
              </a>
              ,{" "}
              <a
                href="/skill.md"
                className="underline hover:text-foreground transition-colors font-mono"
              >
                /skill.md
              </a>
              , and{" "}
              <a
                href="/llms.txt"
                className="underline hover:text-foreground transition-colors font-mono"
              >
                /llms.txt
              </a>{" "}
              make the project easier for agents to understand without losing the visual atmosphere
              of the site itself.
            </>
          }
        />
      </section>

      <section className="space-y-4 max-w-3xl">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">wider context</div>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          <strong className="text-foreground">{appName}</strong> sits within a broader ecosystem of
          internet forward ideas coming from{" "}
          <a href="https://near.org" className="underline hover:text-foreground transition-colors">
            NEAR Protocol
          </a>
          , such as Intents (
          <a href="https://near.com" className="underline hover:text-foreground transition-colors">
            near.com
          </a>
          ), named accounts (
          <a
            href="https://namesky.app/"
            className="underline hover:text-foreground transition-colors"
          >
            namesky.app
          </a>
          ),{" "}
          <a
            href="https://github.com/frol/near-dns"
            className="underline hover:text-foreground transition-colors"
          >
            neardns
          </a>
          ,{" "}
          <a
            href="https://web4.near.page"
            className="underline hover:text-foreground transition-colors"
          >
            web4
          </a>
          ,{" "}
          <a
            href="https://github.com/petersalomonsen/wasm-git-apps"
            className="underline hover:text-foreground transition-colors"
          >
            wasm-git-apps
          </a>
          ,{" "}
          <a
            href="https://outlayer.fastnear.com/"
            className="underline hover:text-foreground transition-colors"
          >
            outlayer
          </a>
          , and the{" "}
          <a
            href="https://near.social/"
            className="underline hover:text-foreground transition-colors"
          >
            blockchain operating system (BOS)
          </a>
          . This site is one product surface inside that arc: a place to inspect runtime composition
          today and keep building richer runtime-native experiences over time.
        </p>
      </section>
    </div>
  );
}

function BoxLink({
  title,
  body,
  href,
  onMouseEnter,
  onFocus,
  onClick,
}: {
  title: string;
  body: string;
  href: string;
  onMouseEnter?: () => void;
  onFocus?: () => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const isStaticFile = /\.(md|txt|json)$/i.test(href);

  if (isStaticFile) {
    return (
      <a href={href} onMouseEnter={onMouseEnter} onFocus={onFocus} onClick={onClick}>
        <Card className="transition-colors hover:bg-muted/20">
          <CardContent className="p-4 space-y-1">
            <div className="font-medium">{title}</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </CardContent>
        </Card>
      </a>
    );
  }

  return (
    <Link to={href} onMouseEnter={onMouseEnter} onFocus={onFocus} onClick={onClick}>
      <Card className="transition-colors hover:bg-muted/20">
        <CardContent className="p-4 space-y-1">
          <div className="font-medium">{title}</div>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function FactCard({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-2">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </CardContent>
    </Card>
  );
}
