-- ============================================================
-- HOPE BUILT ADVISORY — F&C Command Center
-- Supabase Migration 004: FAC Meeting Notes on Documents,
--   One-Click Approval Tokens, Meeting Creation Helper
-- ============================================================

-- ── FAC meeting notes directly on documents ───────────────────
-- Vanessa types these live during the FAC meeting via Meeting Mode.
-- These are DOCUMENT-level notes, not tactical item notes.
-- The distinction:
--   documents.fc_outcome        → what the committee decided
--   documents.discussion_notes  → what was said in the room
--   documents.next_steps        → who does what after the meeting
--   documents.notes             → background context (exists already)
--   tactical_items.discussion_notes → tactical-meeting-specific notes
--   tactical_items.layne_outcome    → Layne's reaction in Tactical

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS fc_outcome        text,        -- APPROVED, ON HOLD, DENIED, etc.
  ADD COLUMN IF NOT EXISTS discussion_notes  text,        -- live notes during FAC
  ADD COLUMN IF NOT EXISTS next_steps        text,        -- action items from FAC discussion
  ADD COLUMN IF NOT EXISTS fc_outcome_at     timestamptz; -- when outcome was set

-- ── One-click approval tokens ─────────────────────────────────
-- When an approval email is sent to the COO/Treasury/Legal,
-- we embed a signed token URL. Clicking it approves without login.
-- Tokens expire in 48 hours. Single use.

CREATE TABLE IF NOT EXISTS approval_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  approval_id     uuid NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  document_id     uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  action          text NOT NULL CHECK (action IN ('approve','deny','hold')),
  approver_name   text,
  approver_email  text,
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  used_at         timestamptz,
  used_by_ip      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_tokens_token
  ON approval_tokens(token) WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_approval_tokens_approval
  ON approval_tokens(approval_id);

ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;

-- Tokens are used by the API route with service role key — no RLS needed for public
CREATE POLICY "service_role_manages_tokens" ON approval_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- ── Function: create token for approval email ─────────────────

CREATE OR REPLACE FUNCTION create_approval_token(
  p_approval_id   uuid,
  p_action        text,
  p_approver_name text DEFAULT NULL,
  p_approver_email text DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token     text;
  v_doc_id    uuid;
  v_org_id    uuid;
BEGIN
  SELECT document_id, org_id INTO v_doc_id, v_org_id
  FROM approvals WHERE id = p_approval_id;

  INSERT INTO approval_tokens (
    org_id, approval_id, document_id, action,
    approver_name, approver_email
  ) VALUES (
    v_org_id, p_approval_id, v_doc_id, p_action,
    p_approver_name, p_approver_email
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- ── Function: use approval token ──────────────────────────────
-- Called by the one-click API route. Validates and applies the approval.

CREATE OR REPLACE FUNCTION use_approval_token(
  p_token  text,
  p_ip     text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tok       approval_tokens%ROWTYPE;
  v_approval  approvals%ROWTYPE;
  v_status    approval_status;
BEGIN
  -- Get and lock the token
  SELECT * INTO v_tok
  FROM approval_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token invalid, expired, or already used');
  END IF;

  -- Mark token as used
  UPDATE approval_tokens
  SET used_at = now(), used_by_ip = p_ip
  WHERE id = v_tok.id;

  -- Map action to approval status
  v_status := CASE v_tok.action
    WHEN 'approve' THEN 'approved_by_delegation'::approval_status
    WHEN 'deny'    THEN 'denied'::approval_status
    WHEN 'hold'    THEN 'on_hold'::approval_status
  END;

  -- Apply the approval
  UPDATE approvals
  SET
    status        = v_status,
    approver_name = COALESCE(v_tok.approver_name, approver_name),
    approved_at   = CASE WHEN v_tok.action = 'approve' THEN now() ELSE NULL END,
    denied_at     = CASE WHEN v_tok.action = 'deny'    THEN now() ELSE NULL END,
    updated_at    = now()
  WHERE id = v_tok.approval_id;

  RETURN jsonb_build_object(
    'success',       true,
    'action',        v_tok.action,
    'approval_id',   v_tok.approval_id,
    'document_id',   v_tok.document_id,
    'approver_name', v_tok.approver_name
  );
END;
$$;

-- ── Update v_active_pipeline to include meeting notes ─────────

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
  d.funding_request,
  d.description,
  d.notes,
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
  d.file_status,
  d.file_url,
  d.legal_ticket_number,
  d.submission_deadline,
  d.created_at,
  d.updated_at,
  -- Meeting notes (written during FAC via Meeting Mode)
  d.fc_outcome,
  d.fc_outcome_at,
  d.discussion_notes,
  d.next_steps,
  -- Layne review
  d.layne_outcome,
  d.layne_notes,
  d.layne_reviewed_at,
  -- Current pending stage
  (
    SELECT a.stage FROM approvals a
    WHERE a.document_id = d.id
      AND a.status = 'pending'
      AND a.is_required = true
    ORDER BY a.stage_order ASC
    LIMIT 1
  ) AS current_pending_stage,
  (
    SELECT a.days_at_stage FROM approvals a
    WHERE a.document_id = d.id
      AND a.status = 'pending'
      AND a.is_required = true
    ORDER BY a.stage_order ASC
    LIMIT 1
  ) AS days_in_current_stage,
  (
    SELECT a.is_overdue FROM approvals a
    WHERE a.document_id = d.id
      AND a.status = 'pending'
      AND a.is_required = true
    ORDER BY a.stage_order ASC
    LIMIT 1
  ) AS is_overdue,
  -- BOD
  (
    SELECT m.meeting_date FROM bod_items bi
    JOIN meetings m ON m.id = bi.bod_meeting_id
    WHERE bi.document_id = d.id
  ) AS bod_meeting_date,
  -- Open action items count
  (
    SELECT COUNT(*) FROM action_items ai
    WHERE ai.document_id = d.id AND ai.status IN ('open','in_progress')
  ) AS open_action_item_count,
  -- Open predoc corrections count
  (
    SELECT COUNT(*) FROM predoc_corrections pc
    WHERE pc.document_id = d.id AND pc.is_resolved = false
  ) AS open_correction_count
FROM documents d
WHERE d.is_archived = false
  AND d.pipeline_status NOT IN ('fully_executed', 'denied', 'archived');

-- ── Helper: auto-archive when fully executed ──────────────────
-- When fc_outcome is set to APPROVED and all approvals are done,
-- optionally auto-archive after N days.
-- For now, this is a manual action — but the trigger is here for later.

CREATE OR REPLACE FUNCTION maybe_auto_archive()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- When pipeline reaches fully_executed, set archive flag opportunity
  -- (actual archive is manual — coordinator confirms)
  -- This trigger fires and can be extended to auto-archive after a delay
  RETURN NEW;
END;
$$;

-- ── Organization settings: add approval email config ─────────

UPDATE organizations
SET settings = settings || '{
  "approval_email_expiry_hours": 48,
  "send_approval_emails": true,
  "require_login_for_approval": false
}'::jsonb
WHERE slug = 'idea-tx';
