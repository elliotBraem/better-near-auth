import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthClient } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_layout/_authenticated/organizations/new")({
  head: () => ({
    meta: [
      { title: "New Organization | app" },
      { name: "description", content: "Create a new organization." },
    ],
  }),
  component: NewOrganization,
});

function NewOrganization() {
  const router = useRouter();
  const auth = useAuthClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await auth.organization.create({
        name,
        slug,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async (data) => {
      toast.success(`Organization "${data?.name}" created`);
      if (data?.slug) {
        await router.navigate({
          to: "/organizations/$slug",
          params: { slug: data.slug },
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create organization");
    },
  });

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === generateSlug(name.slice(0, -1))) {
      setSlug(generateSlug(value));
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <Card>
          <CardContent className="p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                New Organization
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create a new workspace for your team, then move directly into membership and API key
                management.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/organizations">back to organizations</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="space-y-6"
      >
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-xs font-mono">
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 text-muted-foreground text-right w-32">name</td>
                  <td className="px-4 py-3">
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="My Team"
                      className="font-mono text-xs h-8"
                      required
                    />
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground text-right">slug</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">@</span>
                      <Input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                        placeholder="my-team"
                        pattern="[a-z0-9-]+"
                        className="font-mono text-xs h-8"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Only lowercase letters, numbers, and hyphens
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/organizations">cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || !name || !slug}
            variant="outline"
            size="sm"
          >
            {createMutation.isPending ? "creating..." : "create"}
          </Button>
        </div>
      </form>

      <section className="space-y-4">
        <h2 className="text-xs font-mono text-muted-foreground border-b border-border pb-2">
          what happens next
        </h2>
        <Card>
          <CardContent className="p-4">
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• Your organization will be created immediately</li>
              <li>• You'll be the owner with full permissions</li>
              <li>• You can invite team members from the organization settings</li>
              <li>• You can switch between organizations anytime</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
