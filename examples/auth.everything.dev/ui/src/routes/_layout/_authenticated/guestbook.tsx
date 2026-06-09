import { createFileRoute } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/app";
import {
  GuestbookCard,
  RelayerCard,
  RelayFeedCard,
  useGuestbookGreeting,
} from "@/components/demo-sections";

export const Route = createFileRoute("/_layout/_authenticated/guestbook")({
  head: () => ({
    title: "Guestbook | auth.everything.dev",
    meta: [{ name: "description", content: "Try gasless relayed NEAR guestbook signing." }],
  }),
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    if (session?.user) {
      const network = (context.authClient.near.getState()?.networkId || "mainnet") as
        | "mainnet"
        | "testnet";
      await context.queryClient.ensureQueryData({
        queryKey: ["greeting", network],
        queryFn: async () => {
          const res = await context.authClient.near.view({
            contractId: "hello.near-examples.near",
            methodName: "get_greeting",
          });
          if (res.error) return undefined;
          const result = res?.data?.result;
          return typeof result === "string" ? result : undefined;
        },
        staleTime: 30_000,
      });
    }
  },
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
