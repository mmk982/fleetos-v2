# FleetOS production image — multi-stage, Node 22, non-root.
# Secrets are injected at runtime via env_file / compose; never bake them in.
# Build: docker build -t fleetos:local .
# Bypass package.json `prebuild` (db:migrate) — migrations run in the
# compose `migrate` service against a live Postgres, not during image build.
#
# Image update policy: see docs/DEPLOY.md / docs/RUNBOOK.md ("Image update
# policy"). Rebuild + Trivy rescan monthly and on HIGH/CRITICAL advisories.

# Pin exact 22.x LTS patch (must stay >= package.json engines >=22.12).
# Digest pins the bits; retag pulls still work via the version tag alone.
ARG NODE_VERSION=22.23.4
# Hub digest as of 2026-10-30 (optional digest pin):
#   node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da
ARG NODE_IMAGE=node:${NODE_VERSION}-bookworm-slim

# -----------------------------------------------------------------------------
# 1) Dependencies
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# 2) Build
# -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
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
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Apply Debian security updates available at build time, then strip the
# Node image's global npm/npx/corepack (the standalone app runs `node
# server.js` only — healthcheck uses `node` fetch, never npm). Migrations
# run in the compose `migrate` service on a separate full Node image that
# still has npm/tsx.
#
# Reproducibility trade-off: `apt-get upgrade` means two builds of the same
# Dockerfile on different days can differ when Debian publishes patches.
# Accept that for a smaller actionable CVE surface; pin NODE_IMAGE digest
# and rebuild on a schedule (see docs/DEPLOY.md) to keep drift intentional.
USER root
RUN apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules/npm \
            /usr/local/lib/node_modules/corepack \
            /opt/yarn-v1.22.22 \
  && rm -f /usr/local/bin/npm \
           /usr/local/bin/npx \
           /usr/local/bin/corepack \
           /usr/local/bin/yarn \
           /usr/local/bin/yarnpkg \
  && groupadd --system --gid 10001 fleetos \
  && useradd --system --uid 10001 --gid fleetos --home-dir /app --shell /usr/sbin/nologin fleetos \
  && mkdir -p /app/data/attachments \
  && chown -R fleetos:fleetos /app

COPY --from=builder --chown=fleetos:fleetos /app/.next/standalone ./
COPY --from=builder --chown=fleetos:fleetos /app/package.json ./package.json

USER fleetos
EXPOSE 3000

# No dedicated /api/health route (by design — avoid new app behaviour).
# Compose/Caddy check HTTP /login instead. Uses `node` only (npm removed).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
