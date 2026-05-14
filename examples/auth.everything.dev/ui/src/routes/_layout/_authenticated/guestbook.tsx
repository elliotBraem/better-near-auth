import { createFileRoute } from "@tanstack/react-router";
import { GuestbookCard, RelayerCard, RelayFeedCard, useGuestbookGreeting } from "@/components/demo-sections";

export const Route = createFileRoute("/_layout/_authenticated/guestbook")({
  head: () => ({
    title: "Guestbook | auth.everything.dev",
    meta: [
      { name: "description", content: "Try gasless relayed NEAR guestbook signing." },
    ],
  }),
  component: GuestbookPage,
});

function GuestbookPage() {
  const { data: greeting } = useGuestbookGreeting();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guestbook</h1>
        <p className="text-sm text-muted-foreground">
          Compare gasless relayed signing with direct wallet transactions.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <RelayerCard />
        <GuestbookCard initialGreeting={greeting} />
      </div>
      <RelayFeedCard />
    </div>
  );
}
