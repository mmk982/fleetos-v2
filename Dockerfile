# FleetOS production image — multi-stage, Node 22, non-root.
# Secrets are injected at runtime via env_file / compose; never bake them in.
# Build: docker build -t fleetos:local .
# Bypass package.json `prebuild` (db:migrate) — migrations run in the
# compose `migrate` service against a live Postgres, not during image build.

ARG NODE_VERSION=22.14.0

# -----------------------------------------------------------------------------
# 1) Dependencies
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# 2) Build
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Do not run `npm run build` — its `prebuild` hook calls db:migrate.
RUN npx next build --webpack \
  && cp -r public .next/standalone/ \
  && cp -r .next/static .next/standalone/.next/

# -----------------------------------------------------------------------------
# 3) Runtime
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user (uid 10001) — do not run as root in production.
RUN groupadd --system --gid 10001 fleetos \
  && useradd --system --uid 10001 --gid fleetos --home-dir /app --shell /usr/sbin/nologin fleetos \
  && mkdir -p /app/data/attachments \
  && chown -R fleetos:fleetos /app

COPY --from=builder --chown=fleetos:fleetos /app/.next/standalone ./
COPY --from=builder --chown=fleetos:fleetos /app/package.json ./package.json

USER fleetos
EXPOSE 3000

# No dedicated /api/health route (by design — avoid new app behaviour).
# Compose/Caddy check HTTP /login instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
