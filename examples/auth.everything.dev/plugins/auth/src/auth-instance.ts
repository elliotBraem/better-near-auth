import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, anonymous, organization, phoneNumber } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { siwn } from "better-near-auth";

const orgStatements = {
  ...defaultStatements,
  apiKey: ["create", "read", "update", "delete"],
} as const;

const orgAc = createAccessControl(orgStatements);

const orgRoles = {
  owner: orgAc.newRole({
    ...ownerAc.statements,
    apiKey: ["create", "read", "update", "delete"],
  }),
  admin: orgAc.newRole({
    ...adminAc.statements,
    apiKey: ["create", "read", "update", "delete"],
  }),
  member: orgAc.newRole({
    ...memberAc.statements,
    apiKey: ["read"],
  }),
};

import type { AuthConfig, AuthSiwnConfig, AuthSiwnRecipientsConfig } from "./auth-export";
import type { AuthDatabase } from "./db/driver";
import * as schema from "./db/schema";

function isRecipientsConfig(config: AuthSiwnConfig): config is AuthSiwnRecipientsConfig {
  return "recipients" in config && config.recipients !== undefined;
}

export interface PasskeyRelyingPartyOptions {
  rpID: string;
  rpName: string;
  origin: string;
}

function normalizeOrigin(value: string): string {
  try {
    if (/^https?:\/\//i.test(value)) {
      return new URL(value).origin;
    }
    const hostname = new URL(`https://${value}`).hostname;
    const protocol = hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https";
    return new URL(`${protocol}://${value}`).origin;
  } catch {
    throw new Error(`Invalid passkey origin value: "${value}". Must be a valid URL or hostname.`);
  }
}

function normalizeRpId(value: string): string {
  try {
    const hostname = /^https?:\/\//i.test(value)
      ? new URL(value).hostname
      : new URL(`https://${value}`).hostname;
    if (!hostname) {
      throw new TypeError("Missing hostname");
    }
    return hostname;
  } catch {
    throw new Error(`Invalid passkey RP ID value: "${value}". Must be a valid domain or URL.`);
  }
}

export function resolvePasskeyRelyingPartyOptions(
  config: Pick<AuthConfig, "baseUrl" | "passkey">,
): PasskeyRelyingPartyOptions {
  const passkey = config.passkey;
  const origin = normalizeOrigin(passkey?.origin?.trim() || config.baseUrl);
  const rpID = passkey?.rpID?.trim()
    ? normalizeRpId(passkey.rpID.trim())
    : new URL(origin).hostname;
  const rpName = passkey?.rpName?.trim() || "Everything Dev";

  return { rpID, rpName, origin };
}

function buildSiwnOptions(config: AuthConfig): Parameters<typeof siwn>[0] {
  if (isRecipientsConfig(config.siwn)) {
    return {
      recipients: {
        mainnet: config.siwn.recipients.mainnet,
        testnet: config.siwn.recipients.testnet,
      },
      apiKey: config.siwn.apiKey,
      rpcUrl: config.siwn.rpcUrl,
      relayer: config.siwn.relayer?.accountId
        ? {
            accountId: config.siwn.relayer.accountId,
            privateKey: config.siwn.relayer.privateKey,
          }
        : undefined,
      subAccount: {
        mainnet: {
          parentAccount: config.siwn.subAccount?.mainnet?.parentAccount,
          ...(config.siwn.subAccount?.mainnet?.parentKey
            ? { parentKey: config.siwn.subAccount.mainnet.parentKey }
            : {}),
        },
        testnet: {
          parentAccount: config.siwn.subAccount?.testnet?.parentAccount,
          ...(config.siwn.subAccount?.testnet?.parentKey
            ? { parentKey: config.siwn.subAccount.testnet.parentKey }
            : {}),
        },
      },
    };
  }

  return {
    recipient: config.siwn.recipient,
    apiKey: config.siwn.apiKey,
    rpcUrl: config.siwn.rpcUrl,
    relayer: config.siwn.relayer?.accountId
      ? {
          accountId: config.siwn.relayer.accountId,
          privateKey: config.siwn.relayer.privateKey,
        }
      : undefined,
    subAccount: {
      mainnet: {
        parentAccount: config.siwn.subAccount?.mainnet?.parentAccount,
        ...(config.siwn.subAccount?.mainnet?.parentKey
          ? { parentKey: config.siwn.subAccount.mainnet.parentKey }
          : {}),
      },
      testnet: {
        parentAccount: config.siwn.subAccount?.testnet?.parentAccount,
        ...(config.siwn.subAccount?.testnet?.parentKey
          ? { parentKey: config.siwn.subAccount.testnet.parentKey }
          : {}),
      },
    },
  };
}

async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  console.log(`\n📧 [Email Preview] ============================================`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`----------------------------------------------------------------`);
  console.log(text);
  console.log(`================================================================\n`);
}

async function sendSMS(
  { phoneNumber, code }: { phoneNumber: string; code: string },
  twilio?: { accountSid: string; authToken: string; phoneNumber: string },
) {
  if (twilio) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: phoneNumber,
      From: twilio.phoneNumber,
      Body: `Your verification code is: ${code}`,
    });
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Basic ${btoa(`${twilio.accountSid}:${twilio.authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio error ${res.status}: ${text}`);
    }
    return;
  }

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

export function createAuthInstance(config: AuthConfig, db: AuthDatabase) {
  const passkeyOptions = resolvePasskeyRelyingPartyOptions(config);
  const twilioConfig = config.phoneNumber?.twilio;
  const githubConfig = config.socialProviders?.github;
  const siwnOptions = buildSiwnOptions(config);
  const mainnetRecipient = isRecipientsConfig(siwnOptions)
    ? siwnOptions.recipients.mainnet
    : siwnOptions.recipient;

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
    }),
    trustedOrigins: config.trustedOrigins?.length ? config.trustedOrigins : undefined,
    secret: config.secret,
    baseURL: config.baseUrl,
    socialProviders: {
      github: {
        clientId: githubConfig?.clientId ?? "",
        clientSecret: githubConfig?.clientSecret ?? "",
      },
    },
    plugins: [
      siwn(siwnOptions),
      admin({ defaultRole: "user", adminRoles: ["admin"] }),
      anonymous({ emailDomainName: mainnetRecipient }),
      ...(twilioConfig
        ? [
            phoneNumber({
              sendOTP: async ({ phoneNumber, code }) => {
                await sendSMS({ phoneNumber, code }, twilioConfig);
              },
              signUpOnVerification: {
                getTempEmail: (phoneNumber) => `${phoneNumber}@${mainnetRecipient}`,
                getTempName: (phoneNumber) => phoneNumber,
              },
            }),
          ]
        : []),
      passkey(passkeyOptions),
      organization({
        ac: orgAc,
        roles: orgRoles,
        async sendInvitationEmail(data) {
          const inviteLink = `${config.baseUrl}/accept-invitation/${data.id}`;
          await sendEmail({
            to: data.email,
            subject: `Invitation to join ${data.organization.name}`,
            text: `You've been invited by ${data.inviter.user.name} (${data.inviter.user.email}) to join ${data.organization.name}.\n\nClick here to accept: ${inviteLink}`,
          });
        },
      }),
      apiKey([
        {
          configId: "user-keys",
          defaultPrefix: "api_",
          references: "user",
          enableSessionForAPIKeys: true,
          enableMetadata: true,
          rateLimit: {
            enabled: true,
            timeWindow: 60 * 1000,
            maxRequests: 1000,
          },
        },
        {
          configId: "org-keys",
          defaultPrefix: "org_",
          references: "organization",
          enableMetadata: true,
          rateLimit: {
            enabled: true,
            timeWindow: 60 * 1000,
            maxRequests: 1000,
          },
        },
      ]),
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
export type { AuthConfig } from "./auth-export";
