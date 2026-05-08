import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface ApiKeyFormProps {
  orgId: string;
  onCreate: (name: string, permissions?: Record<string, string[]>) => void;
  isPending: boolean;
}

export function ApiKeyForm({ orgId: _orgId, onCreate, isPending }: ApiKeyFormProps) {
  const [name, setName] = useState("");
  const [permissionTag, setPermissionTag] = useState("");
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  const addPermission = () => {
    if (!permissionTag.trim()) return;
    const [scope, action] = permissionTag.split(":");
    if (!scope || !action) {
      toast.error("Use format scope:action (e.g. registry:read)");
      return;
    }
    setPermissions((prev) => ({
      ...prev,
      [scope]: [...(prev[scope] || []), action],
    }));
    setPermissionTag("");
  };

  const removePermission = (scope: string, action: string) => {
    setPermissions((prev) => ({
      ...prev,
      [scope]: (prev[scope] || []).filter((a) => a !== action),
    }));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const cleanPermissions = Object.entries(permissions).reduce(
      (acc, [scope, actions]) => {
        if (actions.length > 0) acc[scope] = actions;
        return acc;
      },
      {} as Record<string, string[]>,
    );
    onCreate(name.trim(), Object.keys(cleanPermissions).length > 0 ? cleanPermissions : undefined);
    setName("");
    setPermissions({});
  };

  const hasPermissions = Object.values(permissions).some((a) => a.length > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">name</Label>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="API key name"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">permissions</Label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={permissionTag}
            onChange={(e) => setPermissionTag(e.target.value)}
            placeholder="scope:action (e.g. registry:read)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPermission();
              }
            }}
          />
          <Button
            onClick={addPermission}
            variant="outline"
            size="sm"
            disabled={!permissionTag.trim()}
          >
            add
          </Button>
        </div>
        {hasPermissions && (
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(permissions).flatMap(([scope, actions]) =>
              actions.map((action) => (
                <Badge key={`${scope}:${action}`} variant="outline" className="gap-1">
                  {scope}:{action}
                  <button
                    type="button"
                    onClick={() => removePermission(scope, action)}
                    className="hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              )),
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isPending || !name.trim()}
          variant="outline"
          size="sm"
        >
          {isPending ? "creating..." : "create key"}
        </Button>
      </div>
    </div>
  );
}

interface ApiKeyRevealProps {
  apiKey: {
    id: string;
    name: string | null;
    prefix: string | null;
    start: string | null;
    key: string;
    createdAt: Date;
  };
  onDismiss: () => void;
}

export function ApiKeyReveal({ apiKey, onDismiss }: ApiKeyRevealProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey.key);
      toast.success("API key copied");
    } catch {
      toast.error("Failed to copy API key");
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="font-medium">New API key ready</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Copy and store this key now. You will only be able to see the full secret once.
            </p>
          </div>
          <Button onClick={onDismiss} variant="outline" size="sm">
            dismiss
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            readOnly
            value={apiKey.key}
            className="font-mono text-xs"
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.currentTarget.select()}
          />
          <Button onClick={handleCopy} variant="outline" size="sm">
            <Copy className="h-3.5 w-3.5 mr-1" />
            copy
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <InfoRow label="name" value={apiKey.name ?? "unnamed"} />
          <InfoRow label="prefix" value={`${apiKey.prefix ?? "api_"}...`} mono />
          <InfoRow label="created" value={new Date(apiKey.createdAt).toLocaleString()} />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 p-3 grid gap-1 sm:grid-cols-[100px_1fr] sm:gap-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "text-xs font-mono break-all" : "text-sm break-all"}>{value}</div>
    </div>
  );
}
