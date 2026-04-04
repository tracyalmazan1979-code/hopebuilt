-- ============================================================
-- HOPE BUILT ADVISORY — F&C Command Center
-- Supabase Migration 002: CAF Fields, Submitter Type,
--   PreDoc Review Workflow, Meeting Mode Support
-- ============================================================

-- ── New Enums ─────────────────────────────────────────────────

-- Who submitted the document
create type submitter_type as enum (
  'pmsi',           -- PMSI-managed projects (Tracy/PMSI team)
  'idea_internal'   -- IDEA internally managed projects
);

-- PreDoc review status — must clear before FAC
create type predoc_status as enum (
  'not_scheduled',        -- document not yet in a predoc meeting
  'pending_predoc',       -- on the agenda, not yet reviewed
  'corrections_needed',   -- flagged during predoc, blocked from FAC
  'cleared_for_fac'       -- predoc complete, ready for 2:30 PM FAC
);

-- Extend meeting_type enum with predoc sessions
-- NOTE: Postgres can't alter enums in a transaction safely,
-- so we recreate. If running on existing DB, use ADD VALUE instead:
-- ALTER TYPE meeting_type ADD VALUE 'predoc_pmsi' AFTER 'tactical';
-- ALTER TYPE meeting_type ADD VALUE 'predoc_idea' AFTER 'predoc_pmsi';

-- For fresh installs, the 001 migration meeting_type enum
-- should include these. Add here for migration on existing DBs:
ALTER TYPE meeting_type ADD VALUE IF NOT EXISTS 'predoc_pmsi';
ALTER TYPE meeting_type ADD VALUE IF NOT EXISTS 'predoc_idea';

-- ── CAF Fields on Documents ───────────────────────────────────
-- Every field on the IDEA CAF form, so we can auto-generate it

ALTER TABLE documents
  -- Submitter routing (drives predoc + agenda split)
  ADD COLUMN IF NOT EXISTS submitter_type     submitter_type NOT NULL DEFAULT 'pmsi',

  -- CAF Section 0: Header
  ADD COLUMN IF NOT EXISTS date_needed_by     date,
  ADD COLUMN IF NOT EXISTS requester_name     text,
  ADD COLUMN IF NOT EXISTS requester_title    text,
  ADD COLUMN IF NOT EXISTS organization       text,      -- 'IDEA Public Schools Texas', 'IPS Enterprises Inc'

  -- CAF Section 0: Vendor info
  ADD COLUMN IF NOT EXISTS vendor_name        text,
  ADD COLUMN IF NOT EXISTS is_coop_member     boolean,
  ADD COLUMN IF NOT EXISTS coop_name          text,      -- which CO-OP (BuyBoard, TIPS, etc.)
  ADD COLUMN IF NOT EXISTS vendor_is_former_employee boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_last_employment_date date,
  ADD COLUMN IF NOT EXISTS students_on_campus boolean,  -- triggers background check flag

  -- CAF Section 0: Service dates + type
  ADD COLUMN IF NOT EXISTS service_start_date date,
  ADD COLUMN IF NOT EXISTS service_end_date   date,
  ADD COLUMN IF NOT EXISTS document_other     text,      -- "Other" field on Type of Document

  -- CAF Section I: Board approval
  -- (board approval required is already modeled via document_types.requires_bod)
  -- board_approval_date goes here:
  ADD COLUMN IF NOT EXISTS board_approval_date date,

  -- CAF Section II: Urgent request
  ADD COLUMN IF NOT EXISTS is_urgent          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgent_reason      text,
  ADD COLUMN IF NOT EXISTS urgent_date_needed date,

  -- Document package
  ADD COLUMN IF NOT EXISTS budget_sheet_url   text,      -- manually attached by coordinator
  ADD COLUMN IF NOT EXISTS caf_generated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS caf_pdf_url        text,      -- link to generated CAF in Supabase Storage

  -- PreDoc Review workflow
  ADD COLUMN IF NOT EXISTS predoc_status      predoc_status NOT NULL DEFAULT 'not_scheduled',
  ADD COLUMN IF NOT EXISTS predoc_meeting_id  uuid REFERENCES meetings(id),
  ADD COLUMN IF NOT EXISTS predoc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS predoc_reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS predoc_corrections text,      -- notes from predoc review
  ADD COLUMN IF NOT EXISTS predoc_cleared_at  timestamptz;

-- ── PreDoc Corrections Log ────────────────────────────────────
-- Separate table so we can track multiple rounds of corrections
-- (predoc → correction → re-review is a real pattern)

CREATE TABLE IF NOT EXISTS predoc_corrections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  document_id     uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  meeting_id      uuid REFERENCES meetings(id),
  correction_text text NOT NULL,
  flagged_by      uuid REFERENCES users(id),
  flagged_by_name text,               -- for external attendees (PMSI staff)
  flagged_at      timestamptz DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES users(id),
  resolution_note text,
  is_resolved     boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_predoc_corrections_doc
  ON predoc_corrections(document_id);

ALTER TABLE predoc_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_scoped_predoc_corrections" ON predoc_corrections
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "coordinators_manage_predoc_corrections" ON predoc_corrections
  FOR ALL USING (org_id = auth_org_id() AND auth_role() IN ('admin','coordinator','approver'));

-- ── Meeting Mode: Live Note Sessions ─────────────────────────
-- Tracks when a meeting is "live" and enables real-time features

CREATE TABLE IF NOT EXISTS meeting_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  meeting_id      uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  opened_by       uuid REFERENCES users(id),
  opened_at       timestamptz DEFAULT now(),
  closed_at       timestamptz,
  current_doc_id  uuid REFERENCES documents(id),  -- which doc is on screen NOW
  is_active       boolean DEFAULT true,
  -- Realtime presence: who else is in the meeting
  active_users    jsonb DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_meeting
  ON meeting_sessions(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_active
  ON meeting_sessions(org_id, is_active) WHERE is_active = true;

ALTER TABLE meeting_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_scoped_sessions" ON meeting_sessions
  FOR ALL USING (org_id = auth_org_id());

-- ── Live Note Autosave Log ────────────────────────────────────
-- Lightweight audit trail of every autosave during a meeting
-- Lets us recover if Vanessa accidentally overwrites something

CREATE TABLE IF NOT EXISTS meeting_note_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  document_id     uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES meeting_sessions(id),
  field_name      text NOT NULL,    -- 'discussion_notes', 'fc_outcome', 'next_steps'
  previous_value  text,
  new_value       text,
  saved_by        uuid REFERENCES users(id),
  saved_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_snapshots_doc
  ON meeting_note_snapshots(document_id, saved_at DESC);

ALTER TABLE meeting_note_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_scoped_snapshots" ON meeting_note_snapshots
  FOR ALL USING (org_id = auth_org_id());

-- ── Wednesday Workflow: Agenda Recipients Config ──────────────
-- Who gets which agenda on Wednesday morning

CREATE TABLE IF NOT EXISTS agenda_recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  email           text NOT NULL,
  full_name       text,
  meeting_types   meeting_type[],   -- which meeting agendas they receive
  submitter_types submitter_type[], -- PMSI agenda, IDEA agenda, or both
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(org_id, email)
);

ALTER TABLE agenda_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_scoped_recipients" ON agenda_recipients
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "coordinators_manage_recipients" ON agenda_recipients
  FOR ALL USING (org_id = auth_org_id() AND auth_role() IN ('admin','coordinator'));

-- Seed IDEA's Wednesday recipients
-- PMSI PreDoc (9AM): Tracy, Andrew, Stephanie, Bob + Vanessa, Sylvia
-- FAC Meeting (2:30PM): same group + legal/finance as needed
-- The actual emails would be filled in during onboarding

INSERT INTO agenda_recipients (org_id, email, full_name, meeting_types, submitter_types) VALUES
  ('a0000000-0000-0000-0000-000000000001',
   'vanessa.rangel@ideapublicschools.org', 'Vanessa Rangel',
   ARRAY['predoc_pmsi','predoc_idea','fac_doc_rev','tactical']::meeting_type[],
   ARRAY['pmsi','idea_internal']::submitter_type[]),

  ('a0000000-0000-0000-0000-000000000001',
   'sylvia.pena@ideapublicschools.org', 'Sylvia Pena',
   ARRAY['predoc_pmsi','predoc_idea','fac_doc_rev','tactical']::meeting_type[],
   ARRAY['pmsi','idea_internal']::submitter_type[]),

  -- PMSI team: predoc_pmsi + fac_doc_rev for PMSI docs only
  ('a0000000-0000-0000-0000-000000000001',
   'andrew@pmsi.com', 'Andrew Stanton',
   ARRAY['predoc_pmsi','fac_doc_rev']::meeting_type[],
   ARRAY['pmsi']::submitter_type[]),

  ('a0000000-0000-0000-0000-000000000001',
   'stephanie@pmsi.com', 'Stephanie (PMSI)',
   ARRAY['predoc_pmsi','fac_doc_rev']::meeting_type[],
   ARRAY['pmsi']::submitter_type[]),

  ('a0000000-0000-0000-0000-000000000001',
   'bob@pmsi.com', 'Bob (PMSI)',
   ARRAY['predoc_pmsi','fac_doc_rev']::meeting_type[],
   ARRAY['pmsi']::submitter_type[])

ON CONFLICT (org_id, email) DO NOTHING;

-- ── Update v_active_pipeline view to include new fields ───────

CREATE OR REPLACE VIEW v_active_pipeline AS
SELECT
  d.id,
  d.org_id,
  d.meeting_id,
  d.doc_number,
  d.state,
  d.campus_name,
  d.document_type_name,
  d.presenter_name,
  d.amount,
  d.funding_source,
  d.pipeline_status,
  d.predoc_status,
  d.submitter_type,
  d.is_urgent,
  d.is_on_hold,
  d.on_hold_reason,
  d.date_needed_by,
  d.vendor_name,
  d.is_coop_member,
  d.coop_name,
  d.students_on_campus,
  d.sharepoint_folder_url,
  d.budget_sheet_url,
  d.caf_pdf_url,
  d.legal_ticket_number,
  d.created_at,
  d.updated_at,
  -- Current pending stage
  (
    SELECT a.stage FROM approvals a
    WHERE a.document_id = d.id
      AND a.status = 'pending'
      AND a.is_required = true
    ORDER BY a.stage_order ASC
    LIMIT 1
  ) AS current_pending_stage,
  -- Days in current stage
  (
    SELECT a.days_at_stage FROM approvals a
    WHERE a.document_id = d.id
      AND a.status = 'pending'
      AND a.is_required = true
    ORDER BY a.stage_order ASC
    LIMIT 1
  ) AS days_in_current_stage,
  -- Overdue flag
  (
    SELECT a.is_overdue FROM approvals a
    WHERE a.document_id = d.id
      AND a.status = 'pending'
      AND a.is_required = true
    ORDER BY a.stage_order ASC
    LIMIT 1
  ) AS is_overdue,
  -- BOD meeting date
  (
    SELECT m.meeting_date FROM bod_items bi
    JOIN meetings m ON m.id = bi.bod_meeting_id
    WHERE bi.document_id = d.id
  ) AS bod_meeting_date,
  -- Open action items
  (
    SELECT COUNT(*) FROM action_items ai
    WHERE ai.document_id = d.id AND ai.status IN ('open','in_progress')
  ) AS open_action_item_count,
  -- Unresolved predoc corrections
  (
    SELECT COUNT(*) FROM predoc_corrections pc
    WHERE pc.document_id = d.id AND pc.is_resolved = false
  ) AS open_correction_count
FROM documents d
WHERE d.is_archived = false
  AND d.pipeline_status NOT IN ('fully_executed', 'denied', 'archived');

-- ── Wednesday Workflow View ───────────────────────────────────
-- What the agenda builder query looks like for each session

CREATE OR REPLACE VIEW v_wednesday_agenda AS
SELECT
  d.id,
  d.org_id,
  d.submitter_type,
  d.predoc_status,
  d.doc_number,
  d.state,
  d.campus_name,
  d.document_type_name,
  d.presenter_name,
  d.amount,
  d.funding_source,
  d.description,
  d.is_urgent,
  d.date_needed_by,
  d.vendor_name,
  d.is_coop_member,
  d.coop_name,
  d.pipeline_status,
  d.budget_sheet_url,
  d.caf_pdf_url,
  -- Corrections that need resolution before FAC
  (
    SELECT jsonb_agg(jsonb_build_object(
      'correction', pc.correction_text,
      'flagged_by', pc.flagged_by_name,
      'resolved', pc.is_resolved
    ))
    FROM predoc_corrections pc
    WHERE pc.document_id = d.id
  ) AS corrections,
  m.meeting_date AS fac_meeting_date
FROM documents d
LEFT JOIN meetings m ON m.id = d.meeting_id
WHERE d.is_archived = false
  AND d.is_on_hold = false
  AND d.pipeline_status NOT IN ('fully_executed','denied','archived');

-- ── CAF Auto-Flag Trigger ─────────────────────────────────────
-- When a document is inserted, auto-set is_urgent and BOD flags
-- based on amount + document type rules

CREATE OR REPLACE FUNCTION auto_flag_caf_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org     organizations;
  v_doctype document_types;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = new.org_id;
  SELECT * INTO v_doctype FROM document_types WHERE id = new.document_type_id;

  -- Background check flag: if students_on_campus is not set, default false
  IF new.students_on_campus IS NULL THEN
    new.students_on_campus := false;
  END IF;

  -- Vendor former employee: default false
  IF new.vendor_is_former_employee IS NULL THEN
    new.vendor_is_former_employee := false;
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER auto_flag_caf_on_insert
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION auto_flag_caf_fields();

-- ── Realtime: enable for meeting mode ────────────────────────
-- Supabase Realtime lets Vanessa's screen update live
-- as she or others type during the meeting

ALTER PUBLICATION supabase_realtime ADD TABLE documents;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE predoc_corrections;
