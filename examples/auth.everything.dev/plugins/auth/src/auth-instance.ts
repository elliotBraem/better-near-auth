import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, anonymous, organization, phoneNumber } from "better-auth/plugins";
import { siwn } from "better-near-auth";
import type {} from "zod/v4/core";
import type { AuthDatabase } from "./db/driver";
import * as schema from "./db/schema";

async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  console.log(`\n📧 [Email Preview] ============================================`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`----------------------------------------------------------------`);
  console.log(text);
  console.log(`================================================================\n`);
}

async function sendSMS({ phoneNumber, code }: { phoneNumber: string; code: string }) {
  console.log(`\n📱 [SMS Preview] ================================================`);
  console.log(`To: ${phoneNumber}`);
  console.log(`Code: ${code}`);
  console.log(`Message: Your verification code is: ${code}`);
  console.log(`================================================================\n`);
}

async function createPersonalOrganization(
  database: AuthDatabase,
  user: { id: string; name?: string; email?: string; isAnonymous?: boolean },
) {
  if (user.isAnonymous) {
    return null;
  }

  const existingOrg = await database.query.organization.findFirst({
    where: (org, { eq, and }) =>
      and(eq(org.slug, user.id), eq(org.metadata, JSON.stringify({ isPersonal: true }))),
  });

  if (existingOrg) {
    return existingOrg;
  }

  const [personalOrg] = await database
    .insert(schema.organization)
    .values({
      id: crypto.randomUUID(),
      name: user.name || "My Organization",
      slug: user.id,
      logo: null,
      metadata: JSON.stringify({ isPersonal: true }),
      createdAt: new Date(),
    })
    .returning();

  if (!personalOrg) {
    throw new Error("Failed to create personal organization");
  }

  await database.insert(schema.member).values({
    id: crypto.randomUUID(),
    userId: user.id,
    organizationId: personalOrg.id,
    role: "owner",
    createdAt: new Date(),
  });

  return personalOrg;
}

export interface AuthConfig {
  secret: string;
  baseUrl: string;
  account: string;
  corsOrigins?: string[];
  githubClientId?: string;
  githubClientSecret?: string;
  fastnearApiKey?: string;
  nearRpcUrl?: string;
  isProduction?: boolean;
}

export function resolveAuthUrls(domain?: string): { baseUrl: string; trustedOrigins: string[] } | undefined {
  if (!domain) return undefined;

  const hasProtocol = /^https?:\/\//i.test(domain);
  const urlStr = hasProtocol ? domain : `https://${domain}`;

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return undefined;
  }

  const hostname = url.hostname;

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    const origin = url.origin;
    return { baseUrl: origin, trustedOrigins: [origin] };
  }

  const cleanHostname = hostname.replace(/^www\./, "");
  const dotCount = cleanHostname.split(".").length - 1;

  const origin = url.origin;

  if (dotCount === 1) {
    return {
      baseUrl: origin,
      trustedOrigins: [origin, `https://*.${cleanHostname}`],
    };
  }

  return { baseUrl: origin, trustedOrigins: [origin] };
}

export function createAuthInstance(config: AuthConfig, db: AuthDatabase) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
    }),
    trustedOrigins: config.corsOrigins ?? [config.baseUrl],
    secret: config.secret,
    baseURL: config.baseUrl,
    socialProviders: {
      github: {
        clientId: config.githubClientId ?? "",
        clientSecret: config.githubClientSecret ?? "",
      },
    },
    plugins: [
      siwn({
        recipient: config.account,
        relayer: {},
        apiKey: config.fastnearApiKey,
        rpcUrl: config.nearRpcUrl,
      }),
      admin({ defaultRole: "user", adminRoles: ["admin"] }),
      anonymous({ emailDomainName: config.account }),
      phoneNumber({
        sendOTP: async ({ phoneNumber, code }) => {
          await sendSMS({ phoneNumber, code });
        },
        signUpOnVerification: {
          getTempEmail: (phoneNumber) => `${phoneNumber}@${config.account}`,
          getTempName: (phoneNumber) => phoneNumber,
        },
      }),
      passkey(),
      organization({
        async sendInvitationEmail(data) {
          const inviteLink = `${config.baseUrl}/accept-invitation/${data.id}`;
          await sendEmail({
            to: data.email,
            subject: `Invitation to join ${data.organization.name}`,
            text: `You've been invited by ${data.inviter.user.name} (${data.inviter.user.email}) to join ${data.organization.name}.\n\nClick here to accept: ${inviteLink}`,
          });
        },
      }),
      apiKey(),
    ],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your password",
          text: `Click the link to reset your password: ${url}`,
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Verify your email address",
          text: `Click the link to verify your email: ${url}`,
        });
      },
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const userData = user as typeof schema.user.$inferInsert & { isAnonymous?: boolean };
            if (!userData.isAnonymous) {
              await createPersonalOrganization(db, user);
            }
          },
        },
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["siwn", "email-password"],
        allowDifferentEmails: true,
        updateUserInfoOnLink: true,
      },
    },
    session: {
      cookieCache: {
        enabled: config.isProduction ?? false,
        maxAge: 5 * 60,
      },
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: config.isProduction ?? false,
        httpOnly: true,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuthInstance>;
export type AuthSession = Auth["$Infer"]["Session"];
