-- ============================================================
-- HOPE BUILT ADVISORY — F&C Command Center
-- Supabase Migration 003: Document File Status, Submission
--   Deadline, PMSI Email Workflow, Tactical Link
-- ============================================================

-- ── New Enums ─────────────────────────────────────────────────

-- File status is SEPARATE from pipeline status.
-- Pipeline = where is this in approvals?
-- File status = do we physically have the document?
CREATE TYPE doc_file_status AS ENUM (
  'pending_doc',   -- tracker record complete, no file yet (shown as orange NO FILE)
  'received',      -- file attached, ready for review
  'not_required'   -- some items don't need a file (ranking discussions, updates)
);

-- How the document was submitted into the system
CREATE TYPE submission_channel AS ENUM (
  'app_form',      -- submitted through the web app (future state)
  'email',         -- emailed to Vanessa, manually entered (current state)
  'manual'         -- Vanessa created the record directly
);

-- ── Tactical Meeting Link ─────────────────────────────────────
-- Links Tactical meeting to the FAC meeting of same week
-- and tracks when Layne does a solo review instead

ALTER TYPE meeting_type ADD VALUE IF NOT EXISTS 'layne_solo_review';

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS linked_fac_meeting_id uuid REFERENCES meetings(id),
  ADD COLUMN IF NOT EXISTS is_skipped             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_reason            text;   -- 'No tactical this week - Layne solo review'

-- ── Tactical Item Source ──────────────────────────────────────

CREATE TYPE tactical_item_source AS ENUM (
  'fac_carryover',    -- auto-populated from FAC doc of same week
  'tactical_only'     -- manually added to tactical agenda only
);

ALTER TABLE tactical_items
  ADD COLUMN IF NOT EXISTS item_source        tactical_item_source DEFAULT 'tactical_only',
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES documents(id);

-- ── Layne Review Fields on Documents ─────────────────────────
-- Used for both Tactical meeting and solo review
-- Same fields, different context

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS layne_outcome      text,       -- his reaction / decision
  ADD COLUMN IF NOT EXISTS layne_notes        text,
  ADD COLUMN IF NOT EXISTS layne_reviewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS layne_review_mode  text;       -- 'tactical_meeting' | 'solo_review'

-- ── File Status + Submission Deadline ────────────────────────

ALTER TABLE documents
  -- File tracking
  ADD COLUMN IF NOT EXISTS file_status          doc_file_status NOT NULL DEFAULT 'pending_doc',
  ADD COLUMN IF NOT EXISTS file_received_at     timestamptz,
  ADD COLUMN IF NOT EXISTS file_url             text,           -- actual document file URL
  ADD COLUMN IF NOT EXISTS submission_deadline  timestamptz,    -- Tuesday 3PM CST of FAC week

  -- Submission channel
  ADD COLUMN IF NOT EXISTS submission_channel   submission_channel DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS submitted_at         timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by_name    text,           -- 'Tracy Gonzalez - PMSI'
  ADD COLUMN IF NOT EXISTS submission_email_ref text,           -- email subject/ref for manual entries

  -- PMSI-specific: who from PMSI is on this document
  -- Not the same people every time — structural assessment vs contractor ranking
  -- is different PMSI personnel
  ADD COLUMN IF NOT EXISTS pmsi_personnel_names  text[],        -- ['Tracy', 'Andrew', 'Bob']
  ADD COLUMN IF NOT EXISTS pmsi_personnel_emails text[],        -- their emails for CC
  ADD COLUMN IF NOT EXISTS submission_email_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_notes     text;           -- any notes from the submitter

-- ── Auto-set submission_deadline trigger ─────────────────────
-- When a document is inserted, calculate the Tuesday 3 PM CST
-- deadline for the week of its FAC meeting

CREATE OR REPLACE FUNCTION set_submission_deadline()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_fac_date date;
  v_tuesday  date;
BEGIN
  -- Get the FAC meeting date if linked
  IF new.meeting_id IS NOT NULL THEN
    SELECT meeting_date INTO v_fac_date
    FROM meetings
    WHERE id = new.meeting_id AND meeting_type = 'fac_doc_rev';
  END IF;

  -- If we have a FAC date, find the Tuesday before it
  IF v_fac_date IS NOT NULL THEN
    -- Find Tuesday of same week (dow: 0=Sun, 1=Mon, 2=Tue ... 6=Sat)
    -- Wednesday is dow 3. Tuesday is dow 2. Go back 1 day from Wednesday.
    v_tuesday := v_fac_date - interval '1 day';

    -- Set deadline to Tuesday 3 PM CST (21:00 UTC — CST is UTC-6)
    new.submission_deadline := (v_tuesday || ' 21:00:00')::timestamptz AT TIME ZONE 'UTC';
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER set_deadline_on_document_insert
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION set_submission_deadline();

-- ── Auto-populate Tactical FAC Carryover ─────────────────────
-- When a Tactical meeting is linked to a FAC meeting,
-- auto-create tactical_items for each FAC document reviewed that week.
-- Vanessa sees them already populated when she opens Tactical.

CREATE OR REPLACE FUNCTION populate_tactical_fac_carryover(
  p_tactical_meeting_id uuid,
  p_fac_meeting_id      uuid
)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_doc       record;
  v_count     integer := 0;
  v_org_id    uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM meetings WHERE id = p_tactical_meeting_id;

  FOR v_doc IN
    SELECT * FROM documents
    WHERE meeting_id = p_fac_meeting_id
      AND is_archived = false
    ORDER BY doc_number ASC
  LOOP
    -- Only insert if not already there
    IF NOT EXISTS (
      SELECT 1 FROM tactical_items
      WHERE meeting_id = p_tactical_meeting_id
        AND source_document_id = v_doc.id
    ) THEN
      INSERT INTO tactical_items (
        org_id,
        meeting_id,
        agenda_number,
        state,
        campus_name,
        campus_id,
        presenter_name,
        description,
        item_source,
        source_document_id
      ) VALUES (
        v_org_id,
        p_tactical_meeting_id,
        v_doc.doc_number,
        v_doc.state,
        v_doc.campus_name,
        v_doc.campus_id,
        v_doc.presenter_name,
        v_doc.description,
        'fac_carryover',
        v_doc.id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count; -- returns how many items were created
END;
$$;

-- ── Submission Notifications ──────────────────────────────────
-- Tracks every submission-related email: submission receipt,
-- deadline reminders, pending doc alerts

CREATE TABLE IF NOT EXISTS submission_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id),
  document_id       uuid REFERENCES documents(id) ON DELETE CASCADE,
  event_type        text NOT NULL,  -- 'submitted', 'deadline_reminder', 'pending_doc_alert',
                                    -- 'submission_received', 'file_received', 'monday_reminder'
  triggered_at      timestamptz DEFAULT now(),
  triggered_by      uuid REFERENCES users(id),
  recipients        jsonb,          -- [{email, name, role: 'to'|'cc'}]
  email_subject     text,
  email_sent        boolean DEFAULT false,
  email_sent_at     timestamptz,
  notes             text
);

CREATE INDEX IF NOT EXISTS idx_submission_events_doc
  ON submission_events(document_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_events_org
  ON submission_events(org_id, event_type, triggered_at DESC);

ALTER TABLE submission_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_scoped_submission_events" ON submission_events
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "coordinators_manage_submission_events" ON submission_events
  FOR ALL USING (org_id = auth_org_id() AND auth_role() IN ('admin','coordinator'));

-- ── Views ──────────────────────────────────────────────────────

-- Pending doc alert view — what Vanessa sees Wednesday morning
CREATE OR REPLACE VIEW v_pending_docs AS
SELECT
  d.id,
  d.org_id,
  d.campus_name,
  d.document_type_name,
  d.presenter_name,
  d.submitter_type,
  d.state,
  d.amount,
  d.submission_deadline,
  d.submitted_at,
  d.file_status,
  d.pmsi_personnel_names,
  d.pmsi_personnel_emails,
  d.is_urgent,
  -- How overdue is this? (in hours)
  CASE
    WHEN d.submission_deadline IS NOT NULL AND d.file_status = 'pending_doc'
    THEN EXTRACT(EPOCH FROM (now() - d.submission_deadline)) / 3600
    ELSE NULL
  END AS hours_past_deadline,
  -- Is it past Tuesday 3 PM?
  CASE
    WHEN d.submission_deadline IS NOT NULL
    THEN now() > d.submission_deadline
    ELSE false
  END AS is_past_deadline,
  m.meeting_date AS fac_date,
  m.title AS fac_meeting_title
FROM documents d
LEFT JOIN meetings m ON m.id = d.meeting_id
WHERE d.file_status = 'pending_doc'
  AND d.is_archived = false
  AND d.is_on_hold = false
ORDER BY d.submission_deadline ASC NULLS LAST;

-- Tactical meeting view with FAC carryover pre-joined
CREATE OR REPLACE VIEW v_tactical_with_fac AS
SELECT
  ti.id,
  ti.org_id,
  ti.meeting_id,
  ti.agenda_number,
  ti.state,
  ti.campus_name,
  ti.subtopic,
  ti.presenter_name,
  ti.description,
  ti.discussion_notes,
  ti.fc_outcome,
  ti.item_source,
  ti.source_document_id,
  ti.promoted_to_document_id,
  -- Pull live fields from source document for FAC carryover items
  d.fc_outcome           AS fac_outcome,         -- what FC decided
  d.layne_outcome        AS layne_outcome,        -- Layne's reaction
  d.layne_notes          AS layne_notes,
  d.amount               AS doc_amount,
  d.funding_source       AS doc_funding_source,
  d.pipeline_status      AS doc_pipeline_status,
  d.file_status          AS doc_file_status,
  d.is_urgent            AS doc_is_urgent,
  d.legal_ticket_number  AS doc_ticket,
  -- Approval snapshot for context
  (
    SELECT jsonb_agg(jsonb_build_object(
      'stage',  a.stage,
      'status', a.status
    ) ORDER BY a.stage_order)
    FROM approvals a
    WHERE a.document_id = d.id
  ) AS approval_snapshot
FROM tactical_items ti
LEFT JOIN documents d ON d.id = ti.source_document_id
ORDER BY ti.agenda_number ASC NULLS LAST;

-- ── Update dashboard metrics to include pending docs ─────────

CREATE OR REPLACE VIEW v_dashboard_metrics AS
SELECT
  d.org_id,
  COUNT(*)  FILTER (WHERE d.pipeline_status = 'pending_fc_review')       AS needs_fc_review,
  COUNT(*)  FILTER (WHERE d.pipeline_status IN (
    'pending_coo','pending_treasury','pending_legal','pending_finance_committee'
  ))                                                                        AS waiting_on_others,
  COUNT(*)  FILTER (WHERE d.pipeline_status = 'pending_bod')              AS pending_bod,
  COUNT(*)  FILTER (WHERE d.pipeline_status = 'pending_execution')        AS pending_execution,
  COUNT(*)  FILTER (WHERE d.pipeline_status = 'fully_executed')           AS fully_executed,
  COUNT(*)  FILTER (WHERE d.is_on_hold = true)                            AS on_hold,
  -- NEW: pending doc count — items on tracker with no file
  COUNT(*)  FILTER (WHERE d.file_status = 'pending_doc'
                    AND d.is_archived = false)                             AS pending_doc_count,
  -- NEW: past Tuesday deadline with no file
  COUNT(*)  FILTER (WHERE d.file_status = 'pending_doc'
                    AND d.submission_deadline IS NOT NULL
                    AND now() > d.submission_deadline)                     AS overdue_submissions,
  SUM(d.amount) FILTER (WHERE d.pipeline_status NOT IN (
    'fully_executed','denied','archived'
  ))                                                                        AS pipeline_value,
  COUNT(*)  FILTER (WHERE d.pipeline_status NOT IN (
    'fully_executed','denied','archived','on_hold'
  ))                                                                        AS total_active
FROM documents d
GROUP BY d.org_id;

-- ── Org Settings Update: add deadline config ──────────────────

UPDATE organizations
SET settings = settings || '{
  "submission_deadline_day": "tuesday",
  "submission_deadline_hour_cst": 15,
  "submission_deadline_hour_utc": 21,
  "monday_reminder_hour_utc": 14,
  "pending_doc_wednesday_alert_hour_utc": 13
}'::jsonb
WHERE slug = 'idea-tx';
