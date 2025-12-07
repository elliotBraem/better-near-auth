import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

const GUESTBOOK_CONTRACT = "hello.near-examples.near";

export function Guestbook() {
  const [newGreeting, setNewGreeting] = useState("");
  const queryClient = useQueryClient();

  const { data: session } = authClient.useSession();
  const nearClient = authClient.near.getNearClient();

  const { data: greeting } = useQuery({
    queryKey: ["greeting"],
    queryFn: () => nearClient.view<string>(GUESTBOOK_CONTRACT, "get_greeting"),
  });

  const { mutate: addMessage, isPending: isSubmitting } = useMutation({
    mutationFn: async (text: string) => {
      const accountId = authClient.near.getAccountId();
      if (!accountId) throw new Error("Not authenticated");

      return await nearClient
        .transaction(accountId)
        .functionCall(
          GUESTBOOK_CONTRACT,
          "set_greeting",
          { greeting: text },
          { gas: "30 Tgas", attachedDeposit: "0 NEAR" }
        )
        .send({ waitUntil: "FINAL" });
    },
    onSuccess: (outcome, newGreeting) => {
      // Manually update the cache with the new value
      queryClient.setQueryData(["greeting"], newGreeting);
      setNewGreeting("");
      toast.success("Message added successfully!");
      console.log("Transaction successful:", outcome.transaction.hash);
    },
    onError: (error) => {
      console.error("Error adding message:", error);
      toast.error("Failed to add message. Please try again.");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGreeting.trim()) return;
    addMessage(newGreeting);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as any);
    }
  };

  const isLoggedIn = !!session;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guestbook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            placeholder={
              isLoggedIn ? "Leave a message..." : "Sign in to leave a message"
            }
            value={newGreeting}
            onChange={(e) => setNewGreeting(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSubmitting || !isLoggedIn}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isSubmitting || !newGreeting.trim() || !isLoggedIn}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Adding...</span>
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
