import { and, eq } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import { type AuthConfig, createAuthInstance } from "../src/auth-instance";
import { createDatabaseDriver } from "../src/db";
import { loadMigrations, migrate } from "../src/db/migrate";
import * as schema from "../src/db/schema";
import { createApiKeyHandlers } from "../src/handlers/api-keys";
import { createInvitationHandlers } from "../src/handlers/invitations";
import { createMemberHandlers } from "../src/handlers/members";
import { createNearHandlers } from "../src/handlers/near";
import { createOrganizationHandlers } from "../src/handlers/organizations";
import { createSessionHandlers } from "../src/handlers/session";
import { createTeamHandlers } from "../src/handlers/teams";
import { createRequireAuth } from "../src/middleware";
import type { PluginServices } from "../src/service-types";

const TEST_DB_URL = "pglite::memory:";

process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "test-secret-do-not-use-in-production";

export async function createTestServices(configOverrides?: Partial<AuthConfig>) {
  const driver = await createDatabaseDriver(TEST_DB_URL);
  const { migrations } = await Effect.runPromise(loadMigrations());
  if (migrations.length > 0) {
    await Effect.runPromise(migrate(driver.db, migrations));
  }
  const auth = createAuthInstance(
    {
      secret: process.env.BETTER_AUTH_SECRET!,
      baseUrl: "http://localhost:3000",
      siwn: { recipient: "test.near" },
      ...configOverrides,
    },
    driver.db,
  );

  const services: PluginServices = {
    auth,
    db: driver.db,
    handler: (req: Request) => auth.handler(req),
    apiKeyHeaders: ["x-api-key"],
  };

  return { services, driver };
}

export interface TestUser {
  userId: string;
  email: string;
  name: string;
  token: string;
  cookie: string;
  headers: Headers;
  reqHeaders: Record<string, string>;
  personalOrgId: string;
  personalMemberId: string;
}

export async function createTestUser(
  services: PluginServices,
  options?: { email?: string; name?: string },
): Promise<TestUser> {
  const email = options?.email ?? `test-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const name = options?.name ?? "Test User";

  await services.auth.api.signUpEmail({
    body: { email, password: "Test1234!", name },
  });

  await services.db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(eq(schema.user.email, email));

  const signInReq = new Request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Test1234!" }),
  });
  const signInRes = await services.auth.handler(signInReq);
  const cookie = signInRes.headers.get("set-cookie") || "";
  const signInBody = (await signInRes.json()) as Record<string, unknown>;
  const token = signInBody?.token as string | undefined;
  const userId = (signInBody?.user as Record<string, string> | undefined)?.id;

  const dbUser = await services.db.query.user.findFirst({
    where: eq(schema.user.email, email),
  });

  const personalOrg = await services.db.query.organization.findFirst({
    where: eq(schema.organization.slug, dbUser?.id ?? ""),
  });
  const personalMember = personalOrg
    ? await services.db.query.member.findFirst({
        where: and(
          eq(schema.member.userId, dbUser?.id ?? ""),
          eq(schema.member.organizationId, personalOrg.id),
        ),
      })
    : null;

  const headers = new Headers();
  headers.set("cookie", cookie);
  const reqHeaders: Record<string, string> = { cookie };

  return {
    userId: userId ?? dbUser?.id ?? "",
    email,
    name,
    token: token ?? "",
    cookie,
    headers,
    reqHeaders,
    personalOrgId: personalOrg?.id ?? "",
    personalMemberId: personalMember?.id ?? "",
  };
}

export async function createTestOrg(
  services: PluginServices,
  ownerUserId: string,
  options?: { name?: string; slug?: string; metadata?: Record<string, unknown> },
): Promise<{ id: string; name: string; slug: string; memberId: string }> {
  const slug = options?.slug ?? `org-${crypto.randomUUID().slice(0, 8)}`;
  const name = options?.name ?? "Test Org";

  const result = (await services.auth.api.createOrganization({
    body: {
      name,
      slug,
      userId: ownerUserId,
      metadata: options?.metadata,
    },
  })) as {
    id: string;
    name: string;
    slug: string;
    members: Array<{ id: string } | undefined>;
  };

  const memberId = result.members[0]?.id ?? "";

  return { id: result.id, name: result.name, slug: result.slug, memberId };
}

export async function addTestMember(
  services: PluginServices,
  orgId: string,
  userId: string,
  role: "member" | "owner" | "admin" = "member",
): Promise<string> {
  const result = (await services.auth.api.addMember({
    body: {
      userId,
      role,
      organizationId: orgId,
    },
  })) as { id: string };
  return result.id;
}

export async function createTestApiKey(
  services: PluginServices,
  options: { userId: string; configId?: string; name?: string; organizationId?: string },
): Promise<{ key: string; id: string }> {
  const configId = options.configId ?? (options.organizationId ? "org-keys" : "user-keys");
  const result = (await services.auth.api.createApiKey({
    body: {
      userId: options.userId,
      configId,
      name: options.name ?? "Test Key",
      organizationId: options.organizationId,
    },
  })) as { key: string; id: string };
  return { key: result.key, id: result.id };
}

type MiddlewareFn = (opts: {
  context: Record<string, unknown>;
  next: (ctx: {
    context: Record<string, unknown>;
  }) => Promise<{ context: Record<string, unknown> }> | { context: Record<string, unknown> };
}) => Promise<{ context: Record<string, unknown> }> | { context: Record<string, unknown> };

type HandlerFn<R = unknown> = (opts: {
  context: Record<string, unknown>;
  input?: Record<string, unknown>;
}) => Promise<R> | R;

type MockRoute = {
  use: (mw: MiddlewareFn) => { handler: <R>(h: HandlerFn<R>) => HandlerFn<R> };
  handler: <R>(h: HandlerFn<R>) => HandlerFn<R>;
};

interface MockBuilder {
  middleware: ((mw: MiddlewareFn) => MiddlewareFn) & MockRoute;
  [route: string]: MockRoute;
}

function createMockBuilder(): MockBuilder {
  const routeProxy: MockRoute = {
    use: (mw: MiddlewareFn) => ({
      handler:
        <R>(handler: HandlerFn<R>): HandlerFn<R> =>
        async (opts: { context: Record<string, unknown>; input?: Record<string, unknown> }) => {
          const result = await mw({
            context: opts.context,
            next: (ctx) => ctx,
          });
          return handler({ ...opts, context: result.context });
        },
    }),
    handler: <R>(fn: HandlerFn<R>) => fn,
  };

  return new Proxy({} as MockBuilder, {
    get(_target, prop: string) {
      if (prop === "middleware") {
        const fn = ((mw: MiddlewareFn) => mw) as (mw: MiddlewareFn) => MiddlewareFn;
        return Object.assign(fn, routeProxy);
      }
      return routeProxy;
    },
  });
}

export function createTestHandlers(services: PluginServices) {
  const builder = createMockBuilder();
  const requireAuth = createRequireAuth(builder, services);

  return {
    session: createSessionHandlers(services, builder),
    organizations: createOrganizationHandlers(services, builder, requireAuth),
    members: createMemberHandlers(services, builder, requireAuth),
    invitations: createInvitationHandlers(services, builder, requireAuth),
    apiKeys: createApiKeyHandlers(services, builder, requireAuth),
    teams: createTeamHandlers(services, builder, requireAuth),
    near: createNearHandlers(services, builder, requireAuth),
  };
}
