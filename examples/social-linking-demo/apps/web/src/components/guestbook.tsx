import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

const GUESTBOOK_CONTRACT = "hello.near-examples.near";

export function Guestbook() {
  const [greeting, setGreeting] = useState("loading...");
  const [newGreeting, setNewGreeting] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nearClient = authClient.near.getNearClient();

  useEffect(() => {
    nearClient
      .view({ contractId: GUESTBOOK_CONTRACT, methodName: "get_greeting" })
      .then((greeting) => setGreeting(greeting));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGreeting.trim()) return;

    setIsSubmitting(true);

    try {
      await nearClient.sendTx({
        receiverId: GUESTBOOK_CONTRACT,
        actions: [
          nearClient.actions.functionCall({
            methodName: "set_greeting",
            args: { greeting: newGreeting },
            gas: "30000000000000",
            deposit: "0",
          }),
        ],
      });

      setGreeting(newGreeting);

      setNewGreeting("");
    } catch (error) {
      console.error("Error adding message:", error);
      alert("Failed to add message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as any);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guestbook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            placeholder="Leave a message..."
            value={newGreeting}
            onChange={(e) => setNewGreeting(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSubmitting}
            className="flex-1"
          />
          <Button type="submit" disabled={isSubmitting || !newGreeting.trim()}>
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
