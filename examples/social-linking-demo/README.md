# Social + NEAR Account Linking Demo

This example demonstrates how to implement a complete account linking system that combines social OAuth providers (Google, GitHub, etc.) with NEAR Protocol authentication using the `better-near-auth` plugin for Better Auth.

## Features

- **Social OAuth Login** - Sign in with Google, GitHub, Discord, and other providers
- **NEAR Wallet Authentication** - Sign in with NEAR using NEP-413 standard
- **Account Linking** - Link social accounts with NEAR accounts following better-auth best practices
- **Profile Browser** - Public NEAR account profiles at `/${accountId}` routes
- **FastinTEAR Integration** - Browser wallet connectivity via FastinTEAR
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
7. **Profile accessible** at `/[near_account_id]` route

### Flow B: NEAR Login → Link Social Account

1. **User signs in** with NEAR wallet (NEP-413)
2. **Redirected to dashboard** with authenticated session
3. **Click "Link [Provider]"** button (e.g., "Link Google")
4. **OAuth flow initiated** - redirects to provider
5. **User authorizes** the OAuth application
6. **Accounts linked** - social account connected to NEAR account
7. **Profile accessible** at `/[near_account_id]` route

### Profile Browser

- **Public Profiles**: NEAR accounts have public profile pages at `/${accountId}`
- **Profile Data**: Automatically fetched from NEAR Social
- **Social-Only Accounts**: Users who only signed in with social providers (and haven't linked NEAR) do not have public profile pages
- **Profile Information**: Displays NEAR Social profile data including name, bio, avatar, and social links

## Better Auth Account Linking

This example follows better-auth best practices for account linking:

### Server Configuration

```typescript
// apps/server/src/lib/auth.ts
export const auth = betterAuth({
  account: {
    accountLinking: {
      enabled: true, // Enable account linking
      trustedProviders: ["google", "github"], // Optional: auto-link trusted providers
      allowDifferentEmails: false, // Require matching emails (recommended)
      updateUserInfoOnLink: true // Update user info when linking accounts
    }
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }
  },
  plugins: [
    siwn({
      recipient: "localhost:3001",
      anonymous: true,
      emailDomainName: "near.org",
      requireFullAccessKey: false,
    })
  ]
})
```

### Client-Side Linking

```typescript
// Link a social account to the current user
await authClient.linkSocial({
  provider: "google",
  callbackURL: "/dashboard"
})

// Link NEAR account (via better-near-auth)
await authClient.signIn.near({
  // FastinTEAR will handle the NEAR authentication
})

// Unlink an account
await authClient.unlinkAccount({
  providerId: "google" // or "near"
})

// List all linked accounts
const { data } = await authClient.listAccounts()
```

## Project Structure

```
social-linking-demo/
├── apps/
│   ├── web/                                    # React frontend
│   │   ├── src/components/
│   │   │   ├── sign-in-form.tsx               # Multi-provider sign-in
│   │   │   ├── user-menu.tsx                  # Shows linked accounts
│   │   │   ├── near-profile.tsx               # NEAR Social profile display
│   │   │   └── account-linking-panel.tsx      # Link/unlink accounts UI
│   │   ├── src/lib/auth-client.ts             # Better Auth client with siwnClient
│   │   └── src/routes/
│   │       ├── _layout/_authenticated/
│   │       │   └── dashboard.tsx              # Account linking dashboard
│   │       └── $accountId.tsx                 # Public profile pages
│   └── server/                                 # Hono backend
│       ├── src/db/schema/auth.ts              # Extended schema with nearAccount
│       └── src/lib/auth.ts                    # Better Auth with account linking
```

## Key Components

### Account Linking Dashboard

The dashboard (`apps/web/src/routes/_layout/_authenticated/dashboard.tsx`) displays:
- Currently linked accounts
- Available providers to link
- Account unlinking options
- User profile information

### NEAR Profile Component

The `near-profile.tsx` component (`apps/web/src/components/near-profile.tsx`):
- Fetches NEAR Social profile data
- Displays profile information (avatar, name, bio)
- Shows social links and additional metadata
- Handles loading and error states

### Profile Page Route

Public profile pages at `/${accountId}` routes:
- Only available for users with linked NEAR accounts
- Displays NEAR Social profile information
- Accessible without authentication
- Returns 404 for social-only accounts

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
      recipient: "localhost:3001",
      anonymous: true,
      emailDomainName: "near.org",
      requireFullAccessKey: false,
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
      domain: "localhost:3001",
    })
  ]
})
```

## Security Considerations

1. **Email Verification**: Account linking requires email verification by default
2. **Trusted Providers**: Only configure trusted OAuth providers in `trustedProviders`
3. **Different Emails**: Keep `allowDifferentEmails: false` unless you have specific requirements
4. **NEAR Signatures**: All NEAR authentication uses NEP-413 standard signatures
5. **Session Management**: Better Auth handles secure session management automatically

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
- [FastinTEAR Wallet](https://github.com/fastnear/fastintear)

## Common Use Cases

### Link NEAR to Existing Social Account

```typescript
// User is already logged in with Google
const session = await authClient.getSession()

// Now link their NEAR account
await authClient.signIn.near({
  // This will link to existing session if user is authenticated
})
```

### Display All Linked Accounts

```typescript
const { data: accounts } = await authClient.listAccounts()

accounts?.forEach(account => {
  console.log(`${account.provider}: ${account.providerId}`)
})
// Output:
// google: user@example.com
// near: alice.near
```

### Unlink a Specific Account

```typescript
// Prevent users from unlinking their last account
const { data: accounts } = await authClient.listAccounts()

if (accounts && accounts.length > 1) {
  await authClient.unlinkAccount({
    providerId: "github"
  })
}
```

## Troubleshooting

### Account Linking Fails

- Verify email addresses match (if `allowDifferentEmails: false`)
- Check that account linking is enabled in server config
- Ensure user is authenticated before attempting to link

### Profile Page 404

- Profile pages only work for NEAR-linked accounts
- Verify the account ID exists on NEAR
- Check NEAR Social profile data is available

### OAuth Redirect Issues

- Verify `BETTER_AUTH_URL` matches your deployment URL
- Check OAuth provider callback URLs are configured correctly
- Ensure `callbackURL` parameter is set in `linkSocial` calls
