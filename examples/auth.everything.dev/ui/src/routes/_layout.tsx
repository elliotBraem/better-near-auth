import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Building2, FolderKanban, Globe, Home, Settings } from "lucide-react";
import { getAppName, sessionQueryOptions } from "@/app";
import builtOn from "@/assets/built_on.png";
import builtOnRev from "@/assets/built_on_rev.png";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useClientValue } from "@/hooks/use-client";
import { ThemeToggle } from "../components/theme-toggle";
import { UserNav } from "../components/user-nav";

export const Route = createFileRoute("/_layout")({
  beforeLoad: async ({ context }) => {
    const { queryClient, authClient } = context;
    const session = await queryClient.ensureQueryData(
      sessionQueryOptions(authClient, context.session),
    );

    return {
      assetsUrl: context.assetsUrl || "",
      runtimeConfig: context.runtimeConfig,
      session,
    };
  },
  component: Layout,
});

const authenticatedSidebarItems = [
  { icon: Home, label: "home", to: "/" as const },
  { icon: Globe, label: "apps", to: "/apps" as const },
  { icon: FolderKanban, label: "projects", to: "/projects" as const },
  { icon: Building2, label: "organizations", to: "/organizations" as const },
  { icon: Settings, label: "settings", to: "/settings" as const },
];

function Layout() {
  const pathname = useClientValue(() => window.location.pathname, "/");
  const appName = useClientValue(() => getAppName(), "app");
  const { session } = Route.useRouteContext();
  const isAuthenticated = !!session?.user;

  const isActive = (item: (typeof authenticatedSidebarItems)[number]) => {
    return pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full flex bg-background text-foreground">
        <aside className="hidden sm:flex sticky top-0 h-screen shrink-0 w-16 flex-col items-center border-r border-border bg-card animate-fade-in">
          {isAuthenticated && (
            <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-1.5 py-4 min-h-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/"
                    aria-label={`${appName} home`}
                    className="mb-3 flex items-center justify-center w-10 h-10 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-card shadow-sm transition-shadow duration-200 hover:shadow-md"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-foreground"
                      aria-label={`${appName} logo`}
                    >
                      <title>{appName}</title>
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{appName}</TooltipContent>
              </Tooltip>

              {authenticatedSidebarItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                const className = `flex items-center justify-center w-10 h-10 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] shadow-sm transition-all duration-200 ease-out hover:shadow-md ${active ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-muted"}`;

                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <Link to={item.to} className={className}>
                        <Icon className="w-4 h-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}

          <div className="mt-auto shrink-0 w-full flex justify-center py-3 bg-card border-t border-border z-10">
            <ThemeToggle />
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header
            className={`shrink-0 bg-card/50 ${isAuthenticated ? "border-b border-border animate-fade-in" : ""}`}
          >
            <div className="flex items-center justify-between px-4 sm:px-6 h-12">
              {isAuthenticated ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono min-w-0">
                  <Link
                    aria-label={`${appName} home`}
                    className="sm:hidden flex items-center justify-center w-8 h-8 border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-card shadow-sm transition-shadow duration-200 hover:shadow-md"
                    to="/"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4 text-foreground"
                      aria-label={`${appName} logo`}
                    >
                      <title>{appName}</title>
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </Link>
                  <div className="hidden sm:flex items-center gap-2">
                    <span>{appName}</span>
                    <span>/</span>
                    <span className="truncate">
                      {pathname === "/" ? "home" : pathname.slice(1).split("/").join(" / ")}
                    </span>
                  </div>
                </div>
              ) : (
                <Link to="/login" className="text-sm font-medium tracking-tight">
                  {appName}
                </Link>
              )}

              <div className="flex items-center gap-2">
                <UserNav />
              </div>
            </div>
          </header>

          <main className="flex-1 w-full min-h-0 overflow-auto scroll-smooth">
            <div
              className={`w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 animate-fade-in-up ${isAuthenticated ? "max-w-5xl" : "max-w-4xl"}`}
            >
              <Outlet />
            </div>
          </main>

          <footer className="shrink-0 flex justify-center py-6 pb-20 sm:pb-6">
            <a
              href="https://near.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-6 w-[100px]"
            >
              <img
                src={builtOn}
                alt="Built on NEAR"
                className="absolute inset-0 h-full w-full object-contain dark:hidden"
              />
              <img
                src={builtOnRev}
                alt="Built on NEAR"
                className="absolute inset-0 hidden h-full w-full object-contain dark:block"
              />
            </a>
          </footer>

          {isAuthenticated && (
            <nav className="fixed bottom-0 left-0 right-0 sm:hidden border-t border-border bg-card animate-fade-in z-40">
              <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
                {authenticatedSidebarItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  const className = `flex flex-col items-center justify-center gap-0.5 p-1.5 transition-colors duration-200 ${active ? "text-foreground" : "text-muted-foreground"}`;

                  return (
                    <Link key={item.label} to={item.to} className={className}>
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px]">{item.label}</span>
                    </Link>
                  );
                })}
                <div className="flex flex-col items-center justify-center p-1.5">
                  <ThemeToggle />
                </div>
              </div>
            </nav>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
