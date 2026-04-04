-- ============================================================
-- Migration 003 CLEAN — run this instead of the original 003
-- v_tactical_with_fac view removed (created correctly in 004)
-- ============================================================

CREATE TYPE doc_file_status AS ENUM (
  'pending_doc',
  'received',
  'not_required'
);

CREATE TYPE submission_channel AS ENUM (
  'app_form',
  'email',
  'manual'
);

ALTER TYPE meeting_type ADD VALUE IF NOT EXISTS 'layne_solo_review';

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS linked_fac_meeting_id uuid REFERENCES meetings(id),
  ADD COLUMN IF NOT EXISTS is_skipped             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_reason            text;

CREATE TYPE tactical_item_source AS ENUM (
  'fac_carryover',
  'tactical_only'
);

ALTER TABLE tactical_items
  ADD COLUMN IF NOT EXISTS item_source        tactical_item_source DEFAULT 'tactical_only',
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES documents(id);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS layne_outcome      text,
  ADD COLUMN IF NOT EXISTS layne_notes        text,
  ADD COLUMN IF NOT EXISTS layne_reviewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS layne_review_mode  text;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_status          doc_file_status NOT NULL DEFAULT 'pending_doc',
  ADD COLUMN IF NOT EXISTS file_received_at     timestamptz,
  ADD COLUMN IF NOT EXISTS file_url             text,
  ADD COLUMN IF NOT EXISTS submission_deadline  timestamptz,
  ADD COLUMN IF NOT EXISTS submission_channel   submission_channel DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS submitted_at         timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by_name    text,
  ADD COLUMN IF NOT EXISTS submission_email_ref text,
  ADD COLUMN IF NOT EXISTS pmsi_personnel_names  text[],
  ADD COLUMN IF NOT EXISTS pmsi_personnel_emails text[],
  ADD COLUMN IF NOT EXISTS submission_email_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_notes     text;

CREATE OR REPLACE FUNCTION set_submission_deadline()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_fac_date date;
  v_tuesday  date;
BEGIN
  IF new.meeting_id IS NOT NULL THEN
    SELECT meeting_date INTO v_fac_date
    FROM meetings
    WHERE id = new.meeting_id AND meeting_type = 'fac_doc_rev';
  END IF;

  IF v_fac_date IS NOT NULL THEN
    v_tuesday := v_fac_date - interval '1 day';
    new.submission_deadline := (v_tuesday || ' 21:00:00')::timestamptz AT TIME ZONE 'UTC';
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER set_deadline_on_document_insert
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION set_submission_deadline();

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
    IF NOT EXISTS (
      SELECT 1 FROM tactical_items
      WHERE meeting_id = p_tactical_meeting_id
        AND source_document_id = v_doc.id
    ) THEN
      INSERT INTO tactical_items (
        org_id, meeting_id, agenda_number, state, campus_name,
        campus_id, presenter_name, description, item_source, source_document_id
      ) VALUES (
        v_org_id, p_tactical_meeting_id, v_doc.doc_number, v_doc.state,
        v_doc.campus_name, v_doc.campus_id, v_doc.presenter_name,
        v_doc.description, 'fac_carryover', v_doc.id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE TABLE IF NOT EXISTS submission_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id),
  document_id       uuid REFERENCES documents(id) ON DELETE CASCADE,
  event_type        text NOT NULL,
  triggered_at      timestamptz DEFAULT now(),
  triggered_by      uuid REFERENCES users(id),
  recipients        jsonb,
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
  CASE
    WHEN d.submission_deadline IS NOT NULL AND d.file_status = 'pending_doc'
    THEN EXTRACT(EPOCH FROM (now() - d.submission_deadline)) / 3600
    ELSE NULL
  END AS hours_past_deadline,
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

CREATE OR REPLACE VIEW v_dashboard_metrics AS
SELECT
  d.org_id,
  COUNT(*) FILTER (WHERE d.pipeline_status = 'pending_fc_review') AS needs_fc_review,
  COUNT(*) FILTER (WHERE d.pipeline_status IN (
    'pending_coo','pending_treasury','pending_legal','pending_finance_committee'
  )) AS waiting_on_others,
  COUNT(*) FILTER (WHERE d.pipeline_status = 'pending_bod') AS pending_bod,
  COUNT(*) FILTER (WHERE d.pipeline_status = 'pending_execution') AS pending_execution,
  COUNT(*) FILTER (WHERE d.pipeline_status = 'fully_executed') AS fully_executed,
  COUNT(*) FILTER (WHERE d.is_on_hold = true) AS on_hold,
  COUNT(*) FILTER (WHERE d.file_status = 'pending_doc' AND d.is_archived = false) AS pending_doc_count,
  COUNT(*) FILTER (WHERE d.file_status = 'pending_doc'
    AND d.submission_deadline IS NOT NULL
    AND now() > d.submission_deadline) AS overdue_submissions,
  SUM(d.amount) FILTER (WHERE d.pipeline_status NOT IN (
    'fully_executed','denied','archived'
  )) AS pipeline_value,
  COUNT(*) FILTER (WHERE d.pipeline_status NOT IN (
    'fully_executed','denied','archived','on_hold'
  )) AS total_active
FROM documents d
GROUP BY d.org_id;

UPDATE organizations
SET settings = settings || '{
  "submission_deadline_day": "tuesday",
  "submission_deadline_hour_cst": 15,
  "submission_deadline_hour_utc": 21,
  "monday_reminder_hour_utc": 14,
  "pending_doc_wednesday_alert_hour_utc": 13
}'::jsonb
WHERE slug = 'idea-tx';
