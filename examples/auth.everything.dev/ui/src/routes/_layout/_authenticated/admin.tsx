import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { Badge, Button, Card, CardContent, Input } from "@/components";

type AdminUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt?: string | Date | null;
};

type AdminUserListData = AdminUser[] | { users?: AdminUser[]; total?: number };

function normalizeUserList(data: AdminUserListData | null | undefined) {
  if (!data) return { users: [] as AdminUser[], total: 0 };
  if (Array.isArray(data)) return { users: data, total: data.length };
  return { users: data.users ?? [], total: data.total ?? data.users?.length ?? 0 };
}

export const Route = createFileRoute("/_layout/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (!context.auth?.isAdmin) {
      throw redirect({ to: "/home" });
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    await context.queryClient.ensureQueryData({
      queryKey: ["admin", "users"],
      queryFn: async () => {
        const { data, error } = await context.authClient.admin.listUsers({
          query: { limit: 100, offset: 0, sortBy: "createdAt", sortDirection: "desc" },
        });
        if (error) throw new Error(error.message);
        return normalizeUserList(data as AdminUserListData);
      },
      staleTime: 30_000,
    });
  },
  head: () => ({
    title: "Admin | auth.everything.dev",
    meta: [{ name: "description", content: "Manage users and admin-only auth controls." }],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: session } = useQuery(sessionQueryOptions(auth));

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data, error } = await auth.admin.listUsers({
        query: {
          limit: 100,
          offset: 0,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      });
      if (error) throw new Error(error.message);
      return normalizeUserList(data as AdminUserListData);
    },
    staleTime: 30 * 1000,
  });

  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "user" }) => {
      const { error } = await auth.admin.setRole({ userId, role });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const banMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await auth.admin.banUser({
        userId,
        banReason: "Banned from admin dashboard",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await auth.admin.unbanUser({ userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const users = usersQuery.data?.users ?? [];
  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [user.name, user.email, user.id, user.role]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const totalUsers = usersQuery.data?.total ?? users.length;
  const visibleAdminCount = users.filter((user) => user.role === "admin").length;
  const visibleBannedCount = users.filter((user) => user.banned).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Review users, roles, and account access controls.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="users" value={String(totalUsers)} />
        <StatBox label="visible admins" value={String(visibleAdminCount)} />
        <StatBox label="visible banned" value={String(visibleBannedCount)} />
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users by name, email, id, or role"
          />

          {usersQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading users...</div>
          ) : filteredUsers.length > 0 ? (
            <div className="grid gap-3">
              {filteredUsers.map((user) => {
                const isSelf = user.id === session?.user?.id;
                const role = user.role ?? "user";
                const isAdmin = role === "admin";
                return (
                  <div
                    key={user.id}
                    className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="font-medium break-all">
                          {user.name || user.email || user.id}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono break-all">
                          {user.email ?? user.id}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{role}</Badge>
                        {user.banned && <Badge variant="destructive">banned</Badge>}
                        {isSelf && <Badge variant="secondary">you</Badge>}
                      </div>
                    </div>

                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="break-all">id: {user.id}</div>
                      <div>
                        created:{" "}
                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : "unknown"}
                      </div>
                      {user.banReason && (
                        <div className="break-all sm:col-span-2">ban reason: {user.banReason}</div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf || setRoleMutation.isPending}
                        onClick={() =>
                          setRoleMutation.mutate({
                            userId: user.id,
                            role: isAdmin ? "user" : "admin",
                          })
                        }
                      >
                        {isAdmin ? "make user" : "make admin"}
                      </Button>
                      {user.banned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unbanMutation.isPending}
                          onClick={() => unbanMutation.mutate(user.id)}
                        >
                          unban
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSelf || banMutation.isPending}
                          onClick={() => banMutation.mutate(user.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          ban
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No users found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-outset border-[rgb(51,51,51)] dark:border-[rgb(100,100,100)] bg-muted/30 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
