-- RLS for vessels (phase 3 / defence in depth).
-- Reuses phase-1 helpers (app_sees_vessel, app_is_office, app_is_system, …).
-- Runtime: fleetos_app. Owner bypasses RLS (no FORCE).
-- Writes: admin only (MODULE_PERMISSIONS vessels: write). System SELECT via
-- app_sees_vessel; system does not write vessels (unlike notifications).

-- ---------------------------------------------------------------------------
-- Write helper (mirrors MODULE_PERMISSIONS vessels write = admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_can_write_vessels() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin');
$$;

GRANT EXECUTE ON FUNCTION app_can_write_vessels() TO fleetos_app;

-- ---------------------------------------------------------------------------
-- vessels (primary key is the vessel id)
-- ---------------------------------------------------------------------------
ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;

CREATE POLICY vessels_select ON vessels
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(id));

CREATE POLICY vessels_insert ON vessels
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_vessels() AND app_sees_vessel(id));

CREATE POLICY vessels_update ON vessels
  FOR UPDATE TO fleetos_app
  USING (app_can_write_vessels() AND app_sees_vessel(id))
  WITH CHECK (app_can_write_vessels() AND app_sees_vessel(id));

CREATE POLICY vessels_delete ON vessels
  FOR DELETE TO fleetos_app
  USING (app_can_write_vessels() AND app_sees_vessel(id));
