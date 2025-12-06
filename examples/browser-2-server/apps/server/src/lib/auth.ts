
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { siwn } from "better-near-auth";
import { db } from "../db";
import * as schema from "../db/schema/auth";

const getTrustedOrigins = () => {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(",").map(origin => origin.trim());
  }
  // Default to allowing localhost:3001 (web app) in development
  return ["http://localhost:3001", "http://localhost:3000"];
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: schema,
  }),
  trustedOrigins: getTrustedOrigins(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [
    siwn({
      recipient: "better-near-auth.near"
    }),
  ],
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github", "siwn"],
      allowDifferentEmails: true,
      updateUserInfoOnLink: true
    }
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes cache - reduces DB hits
    }
  },
  advanced: {
    defaultCookieAttributes: {
      // In development, use "lax" for sameSite and allow insecure cookies
      // In production, use "none" with secure: true for cross-origin support
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true
    }
  }
});
