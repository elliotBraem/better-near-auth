import { authClient } from "@/lib/auth-client";
import { Gas } from "near-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

const GUESTBOOK_CONTRACT = "hello.near-examples.near";

type SendMode = "relay" | "direct";

export function Guestbook() {
  const [newGreeting, setNewGreeting] = useState("");
  const [sendMode, setSendMode] = useState<SendMode>("relay");
  const queryClient = useQueryClient();

  const { data: session } = authClient.useSession();
  const network = (authClient.near.getState()?.networkId || "mainnet") as "mainnet" | "testnet";

  const { data: greeting } = useQuery({
    queryKey: ["greeting", network],
    queryFn: async () => {
      const res = await authClient.near.view({ contractId: GUESTBOOK_CONTRACT, methodName: "get_greeting" });
      return res.data?.result as string;
    },
  });

  const { mutate: addMessageRelay, isPending: isRelaying } = useMutation({
    mutationFn: async (text: string) => {
      const accountId = authClient.near.getAccountId();
      if (!accountId) throw new Error("Not authenticated");

      const signedDelegateAction = await authClient.near.buildSignedDelegateAction({
        receiverId: GUESTBOOK_CONTRACT,
        actions: [{
          type: "FunctionCall",
          methodName: "set_greeting",
          args: { greeting: text },
          gas: Gas.Tgas(30),
          deposit: BigInt(0),
        }],
      });

      const relayResult = await authClient.near.relayTransaction({
        payload: signedDelegateAction,
      });

      if (relayResult.error) {
        throw new Error(relayResult.error.message || "Relay failed");
      }

      return relayResult.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["greeting", network] });
      setNewGreeting("");
      toast.success("Message relayed (gasless)!");
    },
    onError: (error) => {
      console.error("Relay error:", error);
      toast.error(error instanceof Error ? error.message : "Relay failed. Try direct mode.");
    },
  });

  const { mutate: addMessageDirect, isPending: isDirecting } = useMutation({
    mutationFn: async (text: string) => {
      const accountId = authClient.near.getAccountId();
      if (!accountId) throw new Error("Not authenticated");

      const result = await authClient.near.client
        .transaction(accountId)
        .functionCall(GUESTBOOK_CONTRACT, "set_greeting", { greeting: text }, {
          gas: Gas.Tgas(30),
          attachedDeposit: BigInt(0),
        })
        .send();

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["greeting", network] });
      setNewGreeting("");
      toast.success("Message sent directly!");
    },
    onError: (error) => {
      console.error("Direct send error:", error);
      toast.error(error instanceof Error ? error.message : "Direct send failed.");
    },
  });

  const isPending = isRelaying || isDirecting;
  const isLoggedIn = !!session;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGreeting.trim()) return;
    if (sendMode === "relay") {
      addMessageRelay(newGreeting);
    } else {
      addMessageDirect(newGreeting);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Guestbook</CardTitle>
          <div className="flex gap-1">
            <Button
              variant={sendMode === "relay" ? "default" : "outline"}
              size="sm"
              onClick={() => setSendMode("relay")}
            >
              Gasless
              {sendMode === "relay" && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">Relay</Badge>
              )}
            </Button>
            <Button
              variant={sendMode === "direct" ? "default" : "outline"}
              size="sm"
              onClick={() => setSendMode("direct")}
            >
              Direct
              {sendMode === "direct" && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">You Pay Gas</Badge>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            placeholder={
              isLoggedIn ? "Leave a message..." : "Sign in to leave a message"
            }
            value={newGreeting}
            onChange={(e) => setNewGreeting(e.target.value)}
            disabled={isPending || !isLoggedIn}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isPending || !newGreeting.trim() || !isLoggedIn}
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>{sendMode === "relay" ? "Relaying..." : "Sending..."}</span>
              </div>
            ) : (
              "Add"
            )}
          </Button>
        </form>

        <div className="space-y-3">
          {greeting ? (
            <div className="max-h-64 overflow-y-auto space-y-3">
              <div className="border-l-2 border-muted pl-3 py-2">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    Last message:
                  </p>
                </div>
                <p className="text-sm">{greeting}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No messages yet. Be the first to leave one!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
