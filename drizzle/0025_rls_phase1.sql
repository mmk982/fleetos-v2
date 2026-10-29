-- Phase 1 RLS: certificates, crew_members, crew_certificates,
-- crew_certificate_attachments, access_logs.
-- Runtime role: fleetos_app (NOBYPASSRLS). Owner keeps BYPASS for migrate/seed.
-- Session vars (transaction-local via set_config(..., true)):
--   app.user_id, app.role, app.vessel_id

CREATE OR REPLACE FUNCTION app_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.role', true), '');
$$;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app_vessel_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.vessel_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app_is_system() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() = 'system';
$$;

CREATE OR REPLACE FUNCTION app_is_office() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent', 'read_only');
$$;

-- Mirrors MODULE_PERMISSIONS write for certificates / crew (admin + superintendent).
CREATE OR REPLACE FUNCTION app_can_write_certificates() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent');
$$;

CREATE OR REPLACE FUNCTION app_can_write_crew() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent');
$$;

-- Vessel visibility: office + system see all; scoped roles need matching vessel_id;
-- NULL vessel_id rows are invisible to scoped roles (fail closed).
CREATE OR REPLACE FUNCTION app_sees_vessel(p_vessel_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN app_is_system() THEN true
    WHEN app_is_office() THEN true
    WHEN p_vessel_id IS NULL THEN false
    WHEN app_vessel_id() IS NULL THEN false
    ELSE p_vessel_id = app_vessel_id()
  END;
$$;

CREATE OR REPLACE FUNCTION app_sees_crew_member(p_crew_member_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM crew_members m
    WHERE m.id = p_crew_member_id
      AND app_sees_vessel(m.vessel_id)
  );
$$;

CREATE OR REPLACE FUNCTION app_sees_crew_certificate(p_crew_certificate_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM crew_certificates c
    JOIN crew_members m ON m.id = c.crew_member_id
    WHERE c.id = p_crew_certificate_id
      AND app_sees_vessel(m.vessel_id)
  );
$$;

GRANT EXECUTE ON FUNCTION app_role() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_user_id() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_vessel_id() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_is_system() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_is_office() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_certificates() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_crew() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_vessel(uuid) TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_crew_member(uuid) TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_crew_certificate(uuid) TO fleetos_app;

-- ---------------------------------------------------------------------------
-- certificates (direct vessel_id)
-- ---------------------------------------------------------------------------
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificates_select ON certificates
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY certificates_insert ON certificates
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_certificates() AND app_sees_vessel(vessel_id));

CREATE POLICY certificates_update ON certificates
  FOR UPDATE TO fleetos_app
  USING (app_can_write_certificates() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_certificates() AND app_sees_vessel(vessel_id));

CREATE POLICY certificates_delete ON certificates
  FOR DELETE TO fleetos_app
  USING (app_can_write_certificates() AND app_sees_vessel(vessel_id));

-- ---------------------------------------------------------------------------
-- crew_members (direct vessel_id; nullable → invisible to scoped roles)
-- ---------------------------------------------------------------------------
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY crew_members_select ON crew_members
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY crew_members_insert ON crew_members
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_crew() AND app_sees_vessel(vessel_id));

CREATE POLICY crew_members_update ON crew_members
  FOR UPDATE TO fleetos_app
  USING (app_can_write_crew() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_crew() AND app_sees_vessel(vessel_id));

CREATE POLICY crew_members_delete ON crew_members
  FOR DELETE TO fleetos_app
  USING (app_can_write_crew() AND app_sees_vessel(vessel_id));

-- ---------------------------------------------------------------------------
-- crew_certificates (scoped via parent crew_members.vessel_id)
-- ---------------------------------------------------------------------------
ALTER TABLE crew_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY crew_certificates_select ON crew_certificates
  FOR SELECT TO fleetos_app
  USING (app_sees_crew_member(crew_member_id));

CREATE POLICY crew_certificates_insert ON crew_certificates
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_crew() AND app_sees_crew_member(crew_member_id));

CREATE POLICY crew_certificates_update ON crew_certificates
  FOR UPDATE TO fleetos_app
  USING (app_can_write_crew() AND app_sees_crew_member(crew_member_id))
  WITH CHECK (app_can_write_crew() AND app_sees_crew_member(crew_member_id));

CREATE POLICY crew_certificates_delete ON crew_certificates
  FOR DELETE TO fleetos_app
  USING (app_can_write_crew() AND app_sees_crew_member(crew_member_id));

-- ---------------------------------------------------------------------------
-- crew_certificate_attachments (via crew_certificates → crew_members)
-- ---------------------------------------------------------------------------
ALTER TABLE crew_certificate_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY crew_certificate_attachments_select ON crew_certificate_attachments
  FOR SELECT TO fleetos_app
  USING (app_sees_crew_certificate(crew_certificate_id));

CREATE POLICY crew_certificate_attachments_insert ON crew_certificate_attachments
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_crew() AND app_sees_crew_certificate(crew_certificate_id));

CREATE POLICY crew_certificate_attachments_update ON crew_certificate_attachments
  FOR UPDATE TO fleetos_app
  USING (app_can_write_crew() AND app_sees_crew_certificate(crew_certificate_id))
  WITH CHECK (app_can_write_crew() AND app_sees_crew_certificate(crew_certificate_id));

CREATE POLICY crew_certificate_attachments_delete ON crew_certificate_attachments
  FOR DELETE TO fleetos_app
  USING (app_can_write_crew() AND app_sees_crew_certificate(crew_certificate_id));

-- ---------------------------------------------------------------------------
-- access_logs — no vessel_id column.
-- SELECT: office/system see all; scoped users see only their own rows.
-- INSERT: caller may only insert rows for themselves (app.user_id).
-- No UPDATE/DELETE policies (append-only for fleetos_app).
-- ---------------------------------------------------------------------------
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY access_logs_select ON access_logs
  FOR SELECT TO fleetos_app
  USING (
    app_is_system()
    OR app_is_office()
    OR (user_id IS NOT NULL AND user_id = app_user_id())
  );

CREATE POLICY access_logs_insert ON access_logs
  FOR INSERT TO fleetos_app
  WITH CHECK (
    app_user_id() IS NOT NULL
    AND user_id = app_user_id()
  );
