# Better NEAR Auth - Complete Authentication Example

This example demonstrates a complete authentication system that combines Sign in with NEAR (SIWN) with social OAuth providers (Google, GitHub, Discord, etc.) using the `better-near-auth` plugin for Better Auth.

## Features

- **NEAR Wallet Authentication** - Sign in with NEAR using NEP-413 standard
- **Social OAuth Login** - Sign in with Google, GitHub, Discord, and other providers
- **Account Linking** - Link social accounts with NEAR accounts following better-auth best practices
- **Profile Browser** - Public NEAR account profiles at `/profile/${accountId}` routes
- **Better Auth Integration** - Full-featured authentication with session management
- **FastinTEAR Integration** - Browser wallet connectivity via FastinTEAR
- **Profile Integration** - Automatic fetching of user profiles from NEAR Social
- **TypeScript** - Full type safety across client and server
- **Modern Stack** - React, TanStack Router, Hono, Drizzle ORM

## Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Setup

Copy the example environment files and configure them:

```bash
# Server environment
cp apps/server/.env.example apps/server/.env
# Web environment
cp apps/web/.env.example apps/web/.env
```

Configure your OAuth provider credentials in `apps/server/.env`:

```env
# Social OAuth Providers
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/better-near-auth

# Better Auth
BETTER_AUTH_SECRET=your_secret_key
BETTER_AUTH_URL=http://localhost:3000
```

### 3. Database Setup

Start the Postgres service:

```bash
docker compose up -d
```

### 4. Start the Development Server

```bash
bun run dev
```

- **Web App**: [http://localhost:3001](http://localhost:3001)
- **API Server**: [http://localhost:3000](http://localhost:3000)

## How It Works

This demo showcases two primary authentication flows with account linking capabilities:

### Flow A: Social Login → Link NEAR Account

1. **User signs in** with a social provider (Google, GitHub, etc.)
2. **Redirected to dashboard** with authenticated session
3. **Click "Link NEAR Account"** button on dashboard
4. **FastinTEAR wallet connection** opens for NEAR authentication
5. **User signs NEP-413 message** with their NEAR wallet
6. **Accounts linked** - NEAR account is now connected to social login
7. **Profile accessible** at `/profile/${near_account_id}` route

### Flow B: NEAR Login → Link Social Account

1. **User signs in** with NEAR wallet (NEP-413)
2. **Redirected to dashboard** with authenticated session
3. **Click "Link [Provider]"** button (e.g., "Link Google")
4. **OAuth flow initiated** - redirects to provider
5. **User authorizes** the OAuth application
6. **Accounts linked** - social account connected to NEAR account
7. **Profile accessible** at `/profile/${near_account_id}` route

### Profile Browser

- **Public Profiles**: NEAR accounts have public profile pages at `/profile/${accountId}`
- **Profile Data**: Automatically fetched from NEAR Social
- **Social-Only Accounts**: Users who only signed in with social providers (and haven't linked NEAR) do not have public profile pages
- **Profile Information**: Displays NEAR Social profile data including name, bio, avatar, and social links

### Key Components

- **Server Plugin** (`apps/server/src/lib/auth.ts`) - Better Auth configuration with `siwn` plugin
- **Client Plugin** (`apps/web/src/lib/auth-client.ts`) - Client-side Better Auth with `siwnClient`
- **Database Schema** (`apps/server/src/db/schema/auth.ts`) - Extended schema with `nearAccount` table
- **NEAR Profile Component** (`apps/web/src/components/near-profile.tsx`) - Displays NEAR Social profiles
- **FastinTEAR Integration** (`apps/web/index.html`) - Browser wallet connectivity

## Configuration Options

### Server Configuration

```typescript
// Better Auth with account linking
betterAuth({
  account: {
    accountLinking: {
      enabled: true,
      // Only link accounts with matching emails
      allowDifferentEmails: false,
      // Auto-link these trusted providers
      trustedProviders: ["google", "github"],
      // Update user info when linking
      updateUserInfoOnLink: true
    }
  },
  // Social providers
  socialProviders: {
    google: { /* ... */ },
    github: { /* ... */ }
  },
  // NEAR authentication plugin
  plugins: [
    siwn({
      recipient: "better-near-auth.near",
      anonymous: true,
    })
  ]
})
```

### Client Configuration

```typescript
// Better Auth client with NEAR support
createAuthClient({
  plugins: [
    siwnClient({
      domain: "better-near-auth.near",
    })
  ]
})
```

## Available Scripts

- `bun dev` - Start both web and server in development
- `bun dev:web` - Start only the web application
- `bun dev:server` - Start only the server
- `bun build` - Build all applications
- `bun db:push` - Apply database schema changes
- `bun db:studio` - Open Drizzle Studio database UI

## Learn More

### Better Auth

- [Better Auth Documentation](https://better-auth.com)
- [Account Linking Guide](https://better-auth.com/docs/concepts/users-accounts#account-linking)
- [Social Providers](https://better-auth.com/docs/concepts/oauth)

### NEAR Protocol

- [NEAR Protocol](https://near.org)
- [NEP-413: NEAR Sign In](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)
- [NEAR Social](https://near.social)
- [Fastintear Wallet](https://github.com/fastnear/fastintear)
