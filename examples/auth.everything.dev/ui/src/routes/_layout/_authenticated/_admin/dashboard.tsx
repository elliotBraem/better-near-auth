import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getAppName } from "@/app";
import { Badge, Input } from "@/components";
import { useClientValue } from "@/hooks/use-client";
import { useApiClient } from "@/lib/use-api-client";

type Tab = "server" | "prompt";

export const Route = createFileRoute("/_layout/_authenticated/_admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("server");
  const appName = useClientValue(() => getAppName(), "app");
  const tabs: { key: Tab; label: string }[] = [
    { key: "server", label: "server" },
    { key: "prompt", label: "prompt" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-2 text-xs font-mono">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            {appName}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground">admin</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          {tabs.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`transition-colors ${
                tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "server" && <ServerSection />}
      {tab === "prompt" && <PromptSection />}
    </div>
  );
}

function ServerSection() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["opencode", "serverStatus"],
    queryFn: async () => {
      const { data } = await apiClient.opencode.serverStatus();
      return data;
    },
    refetchInterval: 15000,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.opencode.startServer();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opencode", "serverStatus"] });
    },
  });

  const status = statusQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono">opencode server</span>
        {status?.running ? (
          <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-600/10">
            running
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            not running
          </Badge>
        )}
      </div>

      {statusQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : status ? (
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm max-w-md">
          <span className="text-muted-foreground font-mono">url</span>
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{status.url}</code>
          <span className="text-muted-foreground font-mono">host</span>
          <span>{status.host}</span>
          <span className="text-muted-foreground font-mono">port</span>
          <span>{status.port}</span>
          {status.version && (
            <>
              <span className="text-muted-foreground font-mono">version</span>
              <span>{status.version}</span>
            </>
          )}
          {status.uptime !== undefined && (
            <>
              <span className="text-muted-foreground font-mono">uptime</span>
              <span>{Math.floor(status.uptime)}s</span>
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Status unavailable.</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {startMutation.isPending ? "starting…" : "check server →"}
        </button>
        {startMutation.data && (
          <span className="text-xs text-muted-foreground">{startMutation.data.message}</span>
        )}
      </div>
    </div>
  );
}

function PromptSection() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);

  const createSessionMutation = useMutation({
    mutationFn: async (title?: string) => {
      const { data } = await apiClient.opencode.createSession({ title });
      return data;
    },
    onSuccess: (data) => {
      setSessionId(data.id);
      queryClient.invalidateQueries({ queryKey: ["opencode", "serverStatus"] });
    },
  });

  const sendPromptMutation = useMutation({
    mutationFn: async ({ sid, msg }: { sid: string; msg: string }) => {
      const { data } = await apiClient.opencode.sendPrompt({
        sessionId: sid,
        message: msg,
      });
      return data;
    },
  });

  function handleSend() {
    const msg = prompt.trim();
    if (!msg) return;

    const sid = sessionId;
    if (!sid) {
      createSessionMutation.mutate(msg.slice(0, 80), {
        onSuccess: (session) => {
          setMessages((prev) => [...prev, { role: "user", content: msg }]);
          sendPromptMutation.mutate({ sid: session.id, msg });
          setPrompt("");
        },
      });
    } else {
      setMessages((prev) => [...prev, { role: "user", content: msg }]);
      sendPromptMutation.mutate({ sid, msg });
      setPrompt("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono">prompt</span>
        {sessionId && (
          <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {sessionId.slice(0, 12)}…
          </code>
        )}
      </div>

      {messages.length > 0 && (
        <div className="space-y-1.5 max-h-72 overflow-y-auto border border-border/50 rounded-md p-3">
          {messages.map((m, i) => (
            <div key={i} className="text-sm">
              <span className="text-xs text-muted-foreground font-mono mr-2">
                {m.role === "user" ? ">" : "<"}
              </span>
              {m.content}
            </div>
          ))}
          {sendPromptMutation.isPending && (
            <div className="text-sm text-muted-foreground animate-pulse">thinking…</div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2 items-center"
      >
        <Input
          placeholder={sessionId ? "send a prompt…" : "type a prompt to create a session…"}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 text-sm font-mono"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || sendPromptMutation.isPending}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          send →
        </button>
      </form>
    </div>
  );
}
