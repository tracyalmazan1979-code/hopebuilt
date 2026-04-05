// ============================================================
// HOPE BUILT ADVISORY — F&C Command Center
// TypeScript Types — generated from Supabase schema
// Do not manually edit types that mirror the DB schema.
// ============================================================

// ── Enums ────────────────────────────────────────────────────

export type UserRole =
  | 'admin'
  | 'coordinator'
  | 'approver'
  | 'leadership'
  | 'read_only'

export type MeetingType =
  | 'fac_doc_rev'
  | 'tactical'
  | 'bod'
  | 'predoc_pmsi'
  | 'predoc_idea'
  | 'layne_solo_review'

export type StateRegion =
  | 'TX'
  | 'FL'
  | 'OH'
  | 'IPS_FL'
  | 'TX_IPS'

export type ApprovalStage =
  | 'fc_committee'
  | 'coo'
  | 'treasury_finance'
  | 'legal'
  | 'finance_committee'
  | 'board'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'approved_by_delegation'
  | 'approved_pending_conditions'
  | 'denied'
  | 'on_hold'
  | 'not_required'

export type PipelineStatus =
  | 'pending_fc_review'
  | 'pending_coo'
  | 'pending_treasury'
  | 'pending_legal'
  | 'pending_finance_committee'
  | 'pending_bod'
  | 'pending_execution'
  | 'fully_executed'
  | 'on_hold'
  | 'denied'
  | 'archived'

export type ActionStatus = 'open' | 'in_progress' | 'complete' | 'cancelled'
export type ActionPriority = 'urgent' | 'high' | 'medium' | 'low'
export type NotificationType =
  | 'approval_request'
  | 'approval_reminder_nudge'
  | 'weekly_agenda'
  | 'bod_packet_digest'
  | 'item_approved'
  | 'item_denied'
  | 'item_on_hold'
  | 'action_item_due'

export type BodItemType =
  | 'consent_agenda'
  | 'action_item'
  | 'ratification'
  | 'information_only'

// ── Organization Settings ─────────────────────────────────────

export interface OrgSettings {
  approval_chain: ApprovalStage[]
  bod_amount_threshold: number
  legal_required_doc_types: string[]
  nudge_after_business_days: number
  agenda_send_day: string
  agenda_send_hour: number
  bod_packet_weeks_before: number
  fiscal_year_start_month: number
  committee_name?: string
  coordinator_name?: string
  bod_entities?: string[]
}

// ── Database Row Types ────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
  settings: OrgSettings
  active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  org_id: string
  full_name: string
  email: string
  role: UserRole
  title: string | null
  avatar_initials: string | null
  auth_provider: string
  microsoft_oid: string | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface Campus {
  id: string
  org_id: string
  name: string
  state: StateRegion | null
  region: string | null
  is_active: boolean
  created_at: string
}

export interface DocumentType {
  id: string
  org_id: string
  name: string
  abbreviation: string | null
  requires_legal: boolean
  requires_bod: boolean
  bod_amount_threshold: number | null
  requires_budget_amendment: boolean
  requires_wet_signature: boolean
  approval_stages: ApprovalStage[]
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface Meeting {
  id: string
  org_id: string
  meeting_date: string   // ISO date string
  meeting_type: MeetingType
  state: StateRegion | null
  title: string | null
  agenda_generated_at: string | null
  agenda_sent_at: string | null
  agenda_recipients: string[] | null
  minutes_url: string | null
  coordinator_id: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  org_id: string
  meeting_id: string | null
  doc_number: number | null
  state: StateRegion
  campus_id: string | null
  campus_name: string | null
  document_type_id: string | null
  document_type_name: string | null
  presenter_id: string | null
  presenter_name: string | null
  amount: number | null
  funding_request: string | null
  funding_source: string | null
  description: string | null
  notes: string | null
  next_steps: string | null
  attachment_url: string | null
  sharepoint_folder_url: string | null
  gl_account: string | null
  gl_account_funded: boolean | null
  notified_rm: boolean
  legal_ticket_number: string | null
  pipeline_status: PipelineStatus
  is_archived: boolean
  archived_at: string | null
  is_on_hold: boolean
  on_hold_reason: string | null
  on_hold_since: string | null
  additional_notes: string | null
  file_status: 'pending_doc' | 'received' | 'not_required' | null
  file_url: string | null
  budget_sheet_url: string | null
  caf_pdf_url: string | null
  submitter_type: 'pmsi' | 'idea_internal' | null
  // Tracker columns (from F&C Weekly Doc Review Tracker)
  budget_amendment_reqd: boolean | null
  date_sent_via_adobe: string | null
  date_approved_sent_out: string | null
  wet_signature_notary: string | null
  bod_item_type: string | null
  fc_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Approval {
  id: string
  org_id: string
  document_id: string
  stage: ApprovalStage
  stage_order: number
  status: ApprovalStatus
  is_required: boolean
  approver_id: string | null
  approver_name: string | null
  approved_at: string | null
  denied_at: string | null
  notes: string | null
  conditions: string | null
  ticket_number: string | null
  days_at_stage: number
  is_overdue: boolean
  nudge_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface TacticalItem {
  id: string
  org_id: string
  meeting_id: string
  agenda_number: number | null
  state: StateRegion | null
  campus_id: string | null
  campus_name: string | null
  subtopic: string | null
  presenter_id: string | null
  presenter_name: string | null
  description: string | null
  discussion_notes: string | null
  fc_outcome: string | null
  promoted_to_document_id: string | null
  promoted_at: string | null
  created_at: string
  updated_at: string
}

export interface ActionItem {
  id: string
  org_id: string
  document_id: string | null
  tactical_item_id: string | null
  description: string
  assigned_to_id: string | null
  assigned_to_name: string | null
  due_date: string | null     // ISO date
  status: ActionStatus
  priority: ActionPriority
  completed_at: string | null
  completed_by: string | null
  days_overdue: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BodItem {
  id: string
  org_id: string
  document_id: string
  bod_meeting_id: string | null
  board_entity: string | null
  item_type: BodItemType
  packet_submitted: boolean
  packet_submitted_at: string | null
  board_approved: boolean | null
  approved_at: string | null
  denied_at: string | null
  resolution_number: string | null
  board_notes: string | null
  created_at: string
  updated_at: string
}

export interface NotificationLog {
  id: string
  org_id: string
  document_id: string | null
  action_item_id: string | null
  notification_type: NotificationType
  recipient_id: string | null
  recipient_email: string
  subject: string | null
  sent_at: string
  status: string
  error_message: string | null
  resend_message_id: string | null
}

// ── View Types (from SQL views) ───────────────────────────────

export interface ActivePipelineItem extends Omit<Document, never> {
  current_pending_stage: ApprovalStage | null
  days_in_current_stage: number | null
  is_overdue: boolean | null
  bod_meeting_date: string | null
  open_action_item_count: number
}

export interface DashboardMetrics {
  org_id: string
  needs_fc_review: number
  waiting_on_others: number
  pending_bod: number
  pending_execution: number
  fully_executed: number
  on_hold: number
  pending_doc_count: number
  overdue_submissions: number
  pipeline_value: number | null
  total_active: number
}

// ── Enriched / Joined Types (for UI) ─────────────────────────

export interface DocumentWithApprovals extends Document {
  approvals: Approval[]
  bod_item: BodItem | null
  action_items: ActionItem[]
  meeting: Meeting | null
}

export interface DocumentWithCurrent extends ActivePipelineItem {
  current_approval: Approval | null
}

// ── API / Form Types ──────────────────────────────────────────

export interface SubmitDocumentPayload {
  meeting_id?: string
  state: StateRegion
  campus_name: string
  campus_id?: string
  document_type_id: string
  presenter_name: string
  presenter_id?: string
  amount?: number
  funding_request?: string
  funding_source?: string
  description: string
  notes?: string
  attachment_url?: string
  sharepoint_folder_url?: string
}

export interface UpdateApprovalPayload {
  status: ApprovalStatus
  notes?: string
  conditions?: string
  ticket_number?: string
  approver_name?: string
}

export interface CreateActionItemPayload {
  document_id?: string
  tactical_item_id?: string
  description: string
  assigned_to_id?: string
  assigned_to_name?: string
  due_date?: string
  priority?: ActionPriority
}

// ── UI State Types ────────────────────────────────────────────

export type SwimlaneLane =
  | 'needs_action'      // pending_fc_review
  | 'waiting'           // pending_coo | pending_treasury | pending_legal | pending_finance_committee
  | 'pending_bod'       // pending_bod
  | 'closed'            // fully_executed this week

export interface SwimlaneCard {
  document: ActivePipelineItem
  lane: SwimlaneLane
  urgency: 'overdue' | 'warning' | 'normal'
}

// ── Pipeline Status Display Helpers ──────────────────────────

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  pending_fc_review:          '⏳ Pending FC Review',
  pending_coo:                '🔵 Pending COO',
  pending_treasury:           '🟡 Pending Treasury',
  pending_legal:              '🔴 Pending Legal',
  pending_finance_committee:  '🟠 Pending Finance Committee',
  pending_bod:                '🟣 Pending BOD',
  pending_execution:          '📋 Pending Execution',
  fully_executed:             '✅ Fully Executed',
  on_hold:                    '⏸ On Hold',
  denied:                     '❌ Denied',
  archived:                   '📦 Archived',
}

export const APPROVAL_STAGE_LABELS: Record<ApprovalStage, string> = {
  fc_committee:       'FC Committee',
  coo:                'COO Approval',
  treasury_finance:   'Treasury / Finance',
  legal:              'Legal Review',
  finance_committee:  'Finance Committee',
  board:              'Board Approval',
}

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending:                      'Pending',
  approved:                     'Approved',
  approved_by_delegation:       'Approved by Delegation',
  approved_pending_conditions:  'Approved — Pending Conditions',
  denied:                       'Denied',
  on_hold:                      'On Hold',
  not_required:                 'Not Required',
}

export const STATE_LABELS: Record<StateRegion, string> = {
  TX:     'TX',
  FL:     'FL',
  OH:     'OH',
  IPS_FL: 'IPS/FL',
  TX_IPS: 'TX & IPS',
}
