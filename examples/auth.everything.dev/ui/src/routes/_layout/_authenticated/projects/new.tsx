import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, Input } from "@/components";
import { useApiClient } from "@/lib/use-api-client";

export const Route = createFileRoute("/_layout/_authenticated/projects/new")({
  head: () => ({
    meta: [
      { title: "New Project | app" },
      {
        name: "description",
        content: "Create a new project to organize your NEAR apps.",
      },
    ],
  }),
  component: NewProjectPage,
});

function NewProjectPage() {
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");

  type CreateProjectResult = Awaited<ReturnType<typeof apiClient.projects.createProject>>;

  const createProjectMutation = useMutation<CreateProjectResult, Error, void>({
    mutationFn: () =>
      apiClient.projects.createProject({
        title: title.trim(),
        slug: slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-"),
        description: description.trim() || undefined,
        visibility,
      }),
    onSuccess: (result) => {
      toast.success("Project created");
      navigate({ to: "/projects/$id", params: { id: result.id } });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create project");
    },
  });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          <a href="/home" className="hover:text-foreground transition-colors">
            home
          </a>
          <span>/</span>
          <span>projects</span>
          <span>/</span>
          <span>new</span>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Badge variant="outline">new project</Badge>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Create Project</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Projects are containers for organizing NEAR apps. You can link multiple apps to a
                project and share it with your organization.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="title"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Title
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9-]/g, "-")) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }
              }}
              placeholder="My Project"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="slug" className="text-xs uppercase tracking-wide text-muted-foreground">
              Slug
            </label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="my-project"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Used in URLs. Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="description"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border-2 border-inset border-[rgb(51,51,51)] bg-[rgb(255,255,255)] px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus:ring-2 focus:ring-ring dark:bg-[rgb(40,40,40)] dark:border-[rgb(100,100,100)]"
              placeholder="Describe your project..."
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Visibility</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`rounded-sm border p-4 text-left transition-colors ${
                  visibility === "private"
                    ? "border-foreground bg-muted/20"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="font-medium">Private</div>
                <div className="text-xs text-muted-foreground mt-1">Only org members can view</div>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("unlisted")}
                className={`rounded-sm border p-4 text-left transition-colors ${
                  visibility === "unlisted"
                    ? "border-foreground bg-muted/20"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="font-medium">Unlisted</div>
                <div className="text-xs text-muted-foreground mt-1">Anyone with link can view</div>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`rounded-sm border p-4 text-left transition-colors ${
                  visibility === "public"
                    ? "border-foreground bg-muted/20"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="font-medium">Public</div>
                <div className="text-xs text-muted-foreground mt-1">Anyone can view</div>
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => createProjectMutation.mutate()}
              disabled={!title.trim() || !slug.trim() || createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? "creating..." : "create project"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/home" })}
              disabled={createProjectMutation.isPending}
            >
              cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
