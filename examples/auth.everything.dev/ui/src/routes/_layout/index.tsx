import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { buildRuntimeHref, getActiveRuntime, getAppName } from "@/app";
import { Button } from "@/components";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/_layout/")({
  head: () => ({
    meta: [
      { title: "app | Runtime composition on NEAR" },
      {
        name: "description",
        content:
          "app is an open runtime for apps on NEAR, composed from published config and loaded at runtime.",
      },
    ],
  }),
  component: Landing,
});

const subtitles = [
  <>
    A common runtime for apps on{" "}
    <a href="https://near.org" className="underline hover:text-foreground transition-colors">
      NEAR
    </a>
  </>,
  "upgradable and secure for a verifiable internet",
  "in pursuit of the open web.",
];

function Landing() {
  const { runtimeConfig } = RootRoute.useLoaderData();
  const appName = getAppName(runtimeConfig);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const activeRuntime = getActiveRuntime(runtimeConfig);
  const runtimeLabel = activeRuntime
    ? `${activeRuntime.accountId} / ${activeRuntime.gatewayId}`
    : runtimeConfig?.account
      ? `${runtimeConfig.account} / ${getGatewayLabel(runtimeConfig.hostUrl)}`
      : "runtime / host";
  useEffect(() => {
    const interval = setInterval(() => {
      setSubtitleIndex((i) => (i + 1) % subtitles.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center pb-[8vh] animate-fade-in">
      <div className="flex max-w-3xl flex-col items-center text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground font-mono">
          {runtimeLabel}
        </p>

        <h1
          className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl"
          style={{
            textShadow: "rgba(0,0,0,0.08) 1px 1px 1px, rgba(0,0,0,0.06) 3px 3px 3px",
          }}
        >
          {appName}
        </h1>

        <div className="mt-2 flex min-h-[1.75rem] items-center justify-center sm:min-h-[2rem]">
          <p
            key={subtitleIndex}
            className="text-lg text-foreground sm:text-xl animate-subtitle-cycle"
          >
            {subtitles[subtitleIndex]}
          </p>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Published config composes the host, UI, and API at runtime. The runtime is published from
          NEAR, can share a stable host, and leaves room for new interfaces, plugins, and composed
          applications to grow around the same core record.
        </p>

        <div className="mt-5 flex flex-wrap items-start justify-center gap-3">
          <Button asChild>
            <Link to="/apps" search={{}}>
              browse apps
            </Link>
          </Button>
          <div className="group relative flex flex-col items-center">
            <Button asChild variant="outline">
              <Link to="/about">about</Link>
            </Button>
            <a
              href="/skill.md"
              className="absolute top-full mt-1 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-foreground whitespace-nowrap font-mono"
            >
              for your agent: skill.md
            </a>
          </div>
          <Button asChild variant="outline">
            <a href={buildRuntimeHref("/config", runtimeConfig)}>config</a>
          </Button>
        </div>
      </div>

      <p className="pt-4 text-xs text-muted-foreground text-center max-w-md">
        Software that stays portable, inspectable, and continuously built over time.
      </p>
    </div>
  );
}

function getGatewayLabel(hostUrl?: string) {
  if (!hostUrl) {
    return "gateway";
  }

  try {
    return new URL(hostUrl).host;
  } catch {
    return hostUrl;
  }
}
