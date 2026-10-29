-- Phase 2 RLS: certificate children, deficiencies, insurance, manuals,
-- drawings, monthly forms, particulars/notes, reminders, audits, PSC,
-- notifications. Reuses phase-1 helpers (app_sees_vessel, app_is_office, …).
-- Runtime: fleetos_app. Owner bypasses RLS (no FORCE).

-- ---------------------------------------------------------------------------
-- Write helpers (mirror MODULE_PERMISSIONS / getMonthlyFormAccess)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_can_write_deficiencies() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent', 'management_user');
$$;

CREATE OR REPLACE FUNCTION app_can_write_insurance() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent');
$$;

CREATE OR REPLACE FUNCTION app_can_write_manuals() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent');
$$;

CREATE OR REPLACE FUNCTION app_can_write_drawings() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent');
$$;

-- Requirements CRUD is "full" monthly access (admin/superintendent).
CREATE OR REPLACE FUNCTION app_can_write_monthly_form_requirements() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent');
$$;

-- Executed forms: coarse write + submit roles (admin/superintendent/management/vessel).
CREATE OR REPLACE FUNCTION app_can_write_monthly_executed_forms() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent', 'management_user', 'vessel_user');
$$;

CREATE OR REPLACE FUNCTION app_can_write_particulars() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent');
$$;

CREATE OR REPLACE FUNCTION app_can_write_reminders() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent');
$$;

CREATE OR REPLACE FUNCTION app_can_write_audits() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent', 'management_user');
$$;

CREATE OR REPLACE FUNCTION app_can_write_psc() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role() IN ('admin', 'superintendent', 'management_user');
$$;

-- Parent visibility helpers
CREATE OR REPLACE FUNCTION app_sees_certificate(p_certificate_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM certificates c
    WHERE c.id = p_certificate_id AND app_sees_vessel(c.vessel_id)
  );
$$;

CREATE OR REPLACE FUNCTION app_sees_deficiency(p_deficiency_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM deficiencies d
    WHERE d.id = p_deficiency_id AND app_sees_vessel(d.vessel_id)
  );
$$;

CREATE OR REPLACE FUNCTION app_sees_insurance_policy(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM insurance_policies p
    WHERE p.id = p_id AND app_sees_vessel(p.vessel_id)
  );
$$;

CREATE OR REPLACE FUNCTION app_sees_manual(p_manual_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM manuals m
    WHERE m.id = p_manual_id AND app_sees_vessel(m.vessel_id)
  );
$$;

CREATE OR REPLACE FUNCTION app_sees_drawing(p_drawing_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM drawings d
    WHERE d.id = p_drawing_id AND app_sees_vessel(d.vessel_id)
  );
$$;

CREATE OR REPLACE FUNCTION app_sees_monthly_executed_form(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM monthly_executed_forms f
    WHERE f.id = p_id AND app_sees_vessel(f.vessel_id)
  );
$$;

CREATE OR REPLACE FUNCTION app_sees_vessel_particulars(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM vessel_particulars p
    WHERE p.id = p_id AND app_sees_vessel(p.vessel_id)
  );
$$;

GRANT EXECUTE ON FUNCTION app_can_write_deficiencies() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_insurance() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_manuals() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_drawings() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_monthly_form_requirements() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_monthly_executed_forms() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_particulars() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_reminders() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_audits() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_can_write_psc() TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_certificate(uuid) TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_deficiency(uuid) TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_insurance_policy(uuid) TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_manual(uuid) TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_drawing(uuid) TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_monthly_executed_form(uuid) TO fleetos_app;
GRANT EXECUTE ON FUNCTION app_sees_vessel_particulars(uuid) TO fleetos_app;

-- ---------------------------------------------------------------------------
-- certificate_events / certificate_attachments (via certificates.vessel_id)
-- Write: same as certificates (admin/superintendent) — app_can_write_certificates()
-- ---------------------------------------------------------------------------
ALTER TABLE certificate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificate_events_select ON certificate_events
  FOR SELECT TO fleetos_app
  USING (app_sees_certificate(certificate_id));

CREATE POLICY certificate_events_insert ON certificate_events
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_certificates() AND app_sees_certificate(certificate_id));

CREATE POLICY certificate_events_update ON certificate_events
  FOR UPDATE TO fleetos_app
  USING (app_can_write_certificates() AND app_sees_certificate(certificate_id))
  WITH CHECK (app_can_write_certificates() AND app_sees_certificate(certificate_id));

CREATE POLICY certificate_events_delete ON certificate_events
  FOR DELETE TO fleetos_app
  USING (app_can_write_certificates() AND app_sees_certificate(certificate_id));

ALTER TABLE certificate_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificate_attachments_select ON certificate_attachments
  FOR SELECT TO fleetos_app
  USING (app_sees_certificate(certificate_id));

CREATE POLICY certificate_attachments_insert ON certificate_attachments
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_certificates() AND app_sees_certificate(certificate_id));

CREATE POLICY certificate_attachments_update ON certificate_attachments
  FOR UPDATE TO fleetos_app
  USING (app_can_write_certificates() AND app_sees_certificate(certificate_id))
  WITH CHECK (app_can_write_certificates() AND app_sees_certificate(certificate_id));

CREATE POLICY certificate_attachments_delete ON certificate_attachments
  FOR DELETE TO fleetos_app
  USING (app_can_write_certificates() AND app_sees_certificate(certificate_id));

-- ---------------------------------------------------------------------------
-- deficiencies (+ attachments)
-- ---------------------------------------------------------------------------
ALTER TABLE deficiencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY deficiencies_select ON deficiencies
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY deficiencies_insert ON deficiencies
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_deficiencies() AND app_sees_vessel(vessel_id));

CREATE POLICY deficiencies_update ON deficiencies
  FOR UPDATE TO fleetos_app
  USING (app_can_write_deficiencies() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_deficiencies() AND app_sees_vessel(vessel_id));

CREATE POLICY deficiencies_delete ON deficiencies
  FOR DELETE TO fleetos_app
  USING (app_can_write_deficiencies() AND app_sees_vessel(vessel_id));

ALTER TABLE deficiency_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY deficiency_attachments_select ON deficiency_attachments
  FOR SELECT TO fleetos_app
  USING (app_sees_deficiency(deficiency_id));

CREATE POLICY deficiency_attachments_insert ON deficiency_attachments
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_deficiencies() AND app_sees_deficiency(deficiency_id));

CREATE POLICY deficiency_attachments_update ON deficiency_attachments
  FOR UPDATE TO fleetos_app
  USING (app_can_write_deficiencies() AND app_sees_deficiency(deficiency_id))
  WITH CHECK (app_can_write_deficiencies() AND app_sees_deficiency(deficiency_id));

CREATE POLICY deficiency_attachments_delete ON deficiency_attachments
  FOR DELETE TO fleetos_app
  USING (app_can_write_deficiencies() AND app_sees_deficiency(deficiency_id));

-- ---------------------------------------------------------------------------
-- insurance_policies (+ attachments)
-- ---------------------------------------------------------------------------
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY insurance_policies_select ON insurance_policies
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY insurance_policies_insert ON insurance_policies
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_insurance() AND app_sees_vessel(vessel_id));

CREATE POLICY insurance_policies_update ON insurance_policies
  FOR UPDATE TO fleetos_app
  USING (app_can_write_insurance() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_insurance() AND app_sees_vessel(vessel_id));

CREATE POLICY insurance_policies_delete ON insurance_policies
  FOR DELETE TO fleetos_app
  USING (app_can_write_insurance() AND app_sees_vessel(vessel_id));

ALTER TABLE insurance_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY insurance_attachments_select ON insurance_attachments
  FOR SELECT TO fleetos_app
  USING (app_sees_insurance_policy(insurance_policy_id));

CREATE POLICY insurance_attachments_insert ON insurance_attachments
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_insurance() AND app_sees_insurance_policy(insurance_policy_id));

CREATE POLICY insurance_attachments_update ON insurance_attachments
  FOR UPDATE TO fleetos_app
  USING (app_can_write_insurance() AND app_sees_insurance_policy(insurance_policy_id))
  WITH CHECK (app_can_write_insurance() AND app_sees_insurance_policy(insurance_policy_id));

CREATE POLICY insurance_attachments_delete ON insurance_attachments
  FOR DELETE TO fleetos_app
  USING (app_can_write_insurance() AND app_sees_insurance_policy(insurance_policy_id));

-- ---------------------------------------------------------------------------
-- manuals (+ revisions)
-- ---------------------------------------------------------------------------
ALTER TABLE manuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY manuals_select ON manuals
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY manuals_insert ON manuals
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_manuals() AND app_sees_vessel(vessel_id));

CREATE POLICY manuals_update ON manuals
  FOR UPDATE TO fleetos_app
  USING (app_can_write_manuals() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_manuals() AND app_sees_vessel(vessel_id));

CREATE POLICY manuals_delete ON manuals
  FOR DELETE TO fleetos_app
  USING (app_can_write_manuals() AND app_sees_vessel(vessel_id));

ALTER TABLE manual_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY manual_revisions_select ON manual_revisions
  FOR SELECT TO fleetos_app
  USING (app_sees_manual(manual_id));

CREATE POLICY manual_revisions_insert ON manual_revisions
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_manuals() AND app_sees_manual(manual_id));

CREATE POLICY manual_revisions_update ON manual_revisions
  FOR UPDATE TO fleetos_app
  USING (app_can_write_manuals() AND app_sees_manual(manual_id))
  WITH CHECK (app_can_write_manuals() AND app_sees_manual(manual_id));

CREATE POLICY manual_revisions_delete ON manual_revisions
  FOR DELETE TO fleetos_app
  USING (app_can_write_manuals() AND app_sees_manual(manual_id));

-- ---------------------------------------------------------------------------
-- drawings (+ attachments)
-- ---------------------------------------------------------------------------
ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;

CREATE POLICY drawings_select ON drawings
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY drawings_insert ON drawings
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_drawings() AND app_sees_vessel(vessel_id));

CREATE POLICY drawings_update ON drawings
  FOR UPDATE TO fleetos_app
  USING (app_can_write_drawings() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_drawings() AND app_sees_vessel(vessel_id));

CREATE POLICY drawings_delete ON drawings
  FOR DELETE TO fleetos_app
  USING (app_can_write_drawings() AND app_sees_vessel(vessel_id));

ALTER TABLE drawing_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY drawing_attachments_select ON drawing_attachments
  FOR SELECT TO fleetos_app
  USING (app_sees_drawing(drawing_id));

CREATE POLICY drawing_attachments_insert ON drawing_attachments
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_drawings() AND app_sees_drawing(drawing_id));

CREATE POLICY drawing_attachments_update ON drawing_attachments
  FOR UPDATE TO fleetos_app
  USING (app_can_write_drawings() AND app_sees_drawing(drawing_id))
  WITH CHECK (app_can_write_drawings() AND app_sees_drawing(drawing_id));

CREATE POLICY drawing_attachments_delete ON drawing_attachments
  FOR DELETE TO fleetos_app
  USING (app_can_write_drawings() AND app_sees_drawing(drawing_id));

-- ---------------------------------------------------------------------------
-- monthly_form_requirements / monthly_executed_forms (+ attachments)
-- ---------------------------------------------------------------------------
ALTER TABLE monthly_form_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_form_requirements_select ON monthly_form_requirements
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY monthly_form_requirements_insert ON monthly_form_requirements
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_monthly_form_requirements() AND app_sees_vessel(vessel_id));

CREATE POLICY monthly_form_requirements_update ON monthly_form_requirements
  FOR UPDATE TO fleetos_app
  USING (app_can_write_monthly_form_requirements() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_monthly_form_requirements() AND app_sees_vessel(vessel_id));

CREATE POLICY monthly_form_requirements_delete ON monthly_form_requirements
  FOR DELETE TO fleetos_app
  USING (app_can_write_monthly_form_requirements() AND app_sees_vessel(vessel_id));

ALTER TABLE monthly_executed_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_executed_forms_select ON monthly_executed_forms
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY monthly_executed_forms_insert ON monthly_executed_forms
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_monthly_executed_forms() AND app_sees_vessel(vessel_id));

CREATE POLICY monthly_executed_forms_update ON monthly_executed_forms
  FOR UPDATE TO fleetos_app
  USING (app_can_write_monthly_executed_forms() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_monthly_executed_forms() AND app_sees_vessel(vessel_id));

CREATE POLICY monthly_executed_forms_delete ON monthly_executed_forms
  FOR DELETE TO fleetos_app
  USING (app_can_write_monthly_executed_forms() AND app_sees_vessel(vessel_id));

ALTER TABLE monthly_executed_form_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_executed_form_attachments_select ON monthly_executed_form_attachments
  FOR SELECT TO fleetos_app
  USING (app_sees_monthly_executed_form(executed_form_id));

CREATE POLICY monthly_executed_form_attachments_insert ON monthly_executed_form_attachments
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_monthly_executed_forms() AND app_sees_monthly_executed_form(executed_form_id));

CREATE POLICY monthly_executed_form_attachments_update ON monthly_executed_form_attachments
  FOR UPDATE TO fleetos_app
  USING (app_can_write_monthly_executed_forms() AND app_sees_monthly_executed_form(executed_form_id))
  WITH CHECK (app_can_write_monthly_executed_forms() AND app_sees_monthly_executed_form(executed_form_id));

CREATE POLICY monthly_executed_form_attachments_delete ON monthly_executed_form_attachments
  FOR DELETE TO fleetos_app
  USING (app_can_write_monthly_executed_forms() AND app_sees_monthly_executed_form(executed_form_id));

-- ---------------------------------------------------------------------------
-- vessel_particulars (+ attachments), vessel_notes
-- ---------------------------------------------------------------------------
ALTER TABLE vessel_particulars ENABLE ROW LEVEL SECURITY;

CREATE POLICY vessel_particulars_select ON vessel_particulars
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY vessel_particulars_insert ON vessel_particulars
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_particulars() AND app_sees_vessel(vessel_id));

CREATE POLICY vessel_particulars_update ON vessel_particulars
  FOR UPDATE TO fleetos_app
  USING (app_can_write_particulars() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_particulars() AND app_sees_vessel(vessel_id));

CREATE POLICY vessel_particulars_delete ON vessel_particulars
  FOR DELETE TO fleetos_app
  USING (app_can_write_particulars() AND app_sees_vessel(vessel_id));

ALTER TABLE vessel_particulars_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY vessel_particulars_attachments_select ON vessel_particulars_attachments
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel_particulars(particulars_id));

CREATE POLICY vessel_particulars_attachments_insert ON vessel_particulars_attachments
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_particulars() AND app_sees_vessel_particulars(particulars_id));

CREATE POLICY vessel_particulars_attachments_update ON vessel_particulars_attachments
  FOR UPDATE TO fleetos_app
  USING (app_can_write_particulars() AND app_sees_vessel_particulars(particulars_id))
  WITH CHECK (app_can_write_particulars() AND app_sees_vessel_particulars(particulars_id));

CREATE POLICY vessel_particulars_attachments_delete ON vessel_particulars_attachments
  FOR DELETE TO fleetos_app
  USING (app_can_write_particulars() AND app_sees_vessel_particulars(particulars_id));

ALTER TABLE vessel_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY vessel_notes_select ON vessel_notes
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY vessel_notes_insert ON vessel_notes
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_particulars() AND app_sees_vessel(vessel_id));

CREATE POLICY vessel_notes_update ON vessel_notes
  FOR UPDATE TO fleetos_app
  USING (app_can_write_particulars() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_particulars() AND app_sees_vessel(vessel_id));

CREATE POLICY vessel_notes_delete ON vessel_notes
  FOR DELETE TO fleetos_app
  USING (app_can_write_particulars() AND app_sees_vessel(vessel_id));

-- ---------------------------------------------------------------------------
-- reminders — nullable vessel_id = fleet-wide (office-managed).
-- Policy: app_sees_vessel(vessel_id) → NULL vessel invisible to scoped roles
-- (same fail-closed as nullable crew.vessel_id). Office/system see all.
-- ---------------------------------------------------------------------------
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminders_select ON reminders
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY reminders_insert ON reminders
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_reminders() AND app_sees_vessel(vessel_id));

CREATE POLICY reminders_update ON reminders
  FOR UPDATE TO fleetos_app
  USING (app_can_write_reminders() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_reminders() AND app_sees_vessel(vessel_id));

CREATE POLICY reminders_delete ON reminders
  FOR DELETE TO fleetos_app
  USING (app_can_write_reminders() AND app_sees_vessel(vessel_id));

-- ---------------------------------------------------------------------------
-- audits / psc_inspections
-- ---------------------------------------------------------------------------
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY audits_select ON audits
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY audits_insert ON audits
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_audits() AND app_sees_vessel(vessel_id));

CREATE POLICY audits_update ON audits
  FOR UPDATE TO fleetos_app
  USING (app_can_write_audits() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_audits() AND app_sees_vessel(vessel_id));

CREATE POLICY audits_delete ON audits
  FOR DELETE TO fleetos_app
  USING (app_can_write_audits() AND app_sees_vessel(vessel_id));

ALTER TABLE psc_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY psc_inspections_select ON psc_inspections
  FOR SELECT TO fleetos_app
  USING (app_sees_vessel(vessel_id));

CREATE POLICY psc_inspections_insert ON psc_inspections
  FOR INSERT TO fleetos_app
  WITH CHECK (app_can_write_psc() AND app_sees_vessel(vessel_id));

CREATE POLICY psc_inspections_update ON psc_inspections
  FOR UPDATE TO fleetos_app
  USING (app_can_write_psc() AND app_sees_vessel(vessel_id))
  WITH CHECK (app_can_write_psc() AND app_sees_vessel(vessel_id));

CREATE POLICY psc_inspections_delete ON psc_inspections
  FOR DELETE TO fleetos_app
  USING (app_can_write_psc() AND app_sees_vessel(vessel_id));

-- ---------------------------------------------------------------------------
-- notifications — own rows only; system can SELECT/INSERT all (sync/digest).
-- UPDATE (mark-read): own rows only. No DELETE policy.
-- ---------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications
  FOR SELECT TO fleetos_app
  USING (
    app_is_system()
    OR (user_id IS NOT NULL AND user_id = app_user_id())
  );

CREATE POLICY notifications_insert ON notifications
  FOR INSERT TO fleetos_app
  WITH CHECK (
    app_is_system()
    OR (app_user_id() IS NOT NULL AND user_id = app_user_id())
  );

CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO fleetos_app
  USING (
    app_is_system()
    OR (user_id IS NOT NULL AND user_id = app_user_id())
  )
  WITH CHECK (
    app_is_system()
    OR (user_id IS NOT NULL AND user_id = app_user_id())
  );
