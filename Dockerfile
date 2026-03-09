# Build stage
FROM node:24-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY examples/browser-2-server/package.json ./examples/browser-2-server/
COPY examples/browser-2-server/apps/server/package.json ./examples/browser-2-server/apps/server/
COPY examples/browser-2-server/apps/web/package.json ./examples/browser-2-server/apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build main package
RUN pnpm --filter better-near-auth build

# Build server app
RUN pnpm --filter @b2s/server build

# Production stage
FROM node:24-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

# Copy package files and node_modules
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built main package
COPY --from=builder /app/dist ./dist

# Copy example directory with its node_modules
COPY --from=builder /app/examples/browser-2-server ./examples/browser-2-server

# Set working directory to server app
WORKDIR /app/examples/browser-2-server/apps/server

# Expose port
EXPOSE 3000

# Start the server
CMD ["pnpm", "start"]
