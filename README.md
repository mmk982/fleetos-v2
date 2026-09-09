# FleetOS v2

Maritime fleet-compliance app (Next.js App Router, Drizzle ORM, PostgreSQL).

## Local development

### 1. Postgres

```bash
docker compose up -d
cp .env.example .env.local   # adjust if needed
npm install
npm run db:migrate
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)  
Postgres host port: **5433** (avoids clashing with a native Windows Postgres on 5432).

### 2. Optional GlitchTip (error tracker)

```bash
docker compose --profile observability up -d
```

Open [http://localhost:8000](http://localhost:8000), create an org/project, copy the DSN into `.env.local` as `GLITCHTIP_DSN=...`, restart `npm run dev`. Controllers report unexpected failures through `src/lib/logging.ts` (`logError`).

## CI / staging deploy

- **CI** (`.github/workflows/ci.yml`): lint + typecheck on every push/PR.
- **Staging deploy** (`.github/workflows/deploy-staging.yml`): manual `workflow_dispatch`, gated on the GitHub Environment named `staging` (configure required reviewers there).

Required Action secrets (document only — never commit values):

| Secret | Purpose |
| --- | --- |
| `STAGING_HOST` | Staging VPS hostname (Phase 7 Hetzner) |
| `STAGING_SSH_USER` | SSH user |
| `STAGING_SSH_KEY` | Private key for that user |
| `STAGING_APP_PATH` | Optional remote compose project path |

Until those secrets exist, the deploy workflow checks out the ref and exits with a warning (scaffold for Phase 7).
