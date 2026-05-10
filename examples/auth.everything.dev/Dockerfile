# syntax=docker/dockerfile:1.7

FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --cwd packages/every-plugin build
RUN bun run postinstall

RUN bun run scripts/resolve-workspace-refs.ts

RUN rm -rf packages/every-plugin packages/everything-dev

RUN bun install --ignore-scripts

FROM oven/bun:1-alpine
WORKDIR /app

RUN apk add --no-cache curl

RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001

COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json .
COPY --from=builder --chown=appuser:appgroup /app/bun.lock .
COPY --from=builder --chown=appuser:appgroup /app/bunfig.toml .
COPY --from=builder --chown=appuser:appgroup /app/host ./host
COPY --from=builder --chown=appuser:appgroup /app/api ./api
COPY --from=builder --chown=appuser:appgroup /app/ui ./ui
COPY --from=builder --chown=appuser:appgroup /app/plugins ./plugins

RUN mkdir -p .bos/generated .bos/logs && \
    chown -R appuser:appgroup .bos && \
    chown appuser:appgroup /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

USER appuser
CMD ["bun", "run", "start"]
