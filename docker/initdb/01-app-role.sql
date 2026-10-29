-- Local-dev only (mounted into Postgres docker-entrypoint-initdb.d).
-- Creates the non-owner runtime role used by the app (DATABASE_URL).
-- Password is local-dev only — never put production passwords in SQL
-- migrations. Production: create the role manually (see docs/RUNBOOK.md / docs/RLS.md).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleetos_app') THEN
    CREATE ROLE fleetos_app LOGIN PASSWORD 'fleetos_app'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE fleetos TO fleetos_app;
GRANT USAGE ON SCHEMA public TO fleetos_app;
