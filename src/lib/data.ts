// ============================================================
// HOPE BUILT ADVISORY — Data Access Layer
// All Supabase queries go here. Never query directly in components.
// ============================================================

import { createClient } from '@/lib/supabase'
import type {
  Document,
  ActivePipelineItem,
  DashboardMetrics,
  DocumentWithApprovals,
  Meeting,
  TacticalItem,
  ActionItem,
  BodItem,
  Approval,
  SubmitDocumentPayload,
  UpdateApprovalPayload,
  CreateActionItemPayload,
  PipelineStatus,
  StateRegion,
  MeetingType,
} from '@/types'

// ── Documents ─────────────────────────────────────────────────

export async function getActivePipeline(filters?: {
  state?: StateRegion
  pipeline_status?: PipelineStatus[]
  is_on_hold?: boolean
}) {
  const supabase = createClient()
  let query = supabase
    .from('v_active_pipeline')
    .select('*')
    .order('updated_at', { ascending: false })

  if (filters?.state) query = query.eq('state', filters.state)
  if (filters?.is_on_hold !== undefined) query = query.eq('is_on_hold', filters.is_on_hold)
  if (filters?.pipeline_status?.length) {
    query = query.in('pipeline_status', filters.pipeline_status)
  }

  const { data, error } = await query
  if (error) throw error
  return data as ActivePipelineItem[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('v_dashboard_metrics')
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function getDocumentWithApprovals(
  documentId: string
): Promise<DocumentWithApprovals | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('documents')
    .select(`
      *,
      approvals(*),
      bod_items(*),
      action_items(*),
      meetings(*)
    `)
    .eq('id', documentId)
    .single()

  if (error) throw error
  return data as DocumentWithApprovals
}

export async function searchDocuments(query: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .or(
      `campus_name.ilike.%${query}%,` +
      `document_type_name.ilike.%${query}%,` +
      `presenter_name.ilike.%${query}%,` +
      `legal_ticket_number.ilike.%${query}%,` +
      `description.ilike.%${query}%`
    )
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data as Document[]
}

export async function getAllDocuments(filters?: {
  state?: StateRegion
  pipeline_status?: PipelineStatus
  is_archived?: boolean
  is_on_hold?: boolean
  requires_bod?: boolean
  meeting_id?: string
}) {
  const supabase = createClient()
  let query = supabase
    .from('documents')
    .select('*, approvals(stage, status, stage_order), bod_items(board_approved, bod_meeting_id)')
    .order('created_at', { ascending: false })

  if (filters?.state) query = query.eq('state', filters.state)
  if (filters?.pipeline_status) query = query.eq('pipeline_status', filters.pipeline_status)
  if (filters?.is_archived !== undefined) query = query.eq('is_archived', filters.is_archived)
  if (filters?.is_on_hold !== undefined) query = query.eq('is_on_hold', filters.is_on_hold)
  if (filters?.meeting_id) query = query.eq('meeting_id', filters.meeting_id)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function submitDocument(payload: SubmitDocumentPayload) {
  const supabase = createClient()

  // Get doc type info for denormalization
  const { data: docType } = await supabase
    .from('document_types')
    .select('name')
    .eq('id', payload.document_type_id)
    .single()

  const { data, error } = await supabase
    .from('documents')
    .insert({
      ...payload,
      document_type_name: docType?.name ?? null,
      pipeline_status: 'pending_fc_review',
    })
    .select()
    .single()

  if (error) throw error
  return data as Document
}

export async function updateDocument(
  documentId: string,
  updates: Partial<Document>
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
    .select()
    .single()

  if (error) throw error
  return data as Document
}

export async function archiveDocument(documentId: string) {
  return updateDocument(documentId, {
    is_archived: true,
    archived_at: new Date().toISOString(),
    pipeline_status: 'archived',
  })
}

export async function putDocumentOnHold(documentId: string, reason: string) {
  return updateDocument(documentId, {
    is_on_hold: true,
    on_hold_reason: reason,
    on_hold_since: new Date().toISOString(),
    pipeline_status: 'on_hold',
  })
}

// ── Approvals ─────────────────────────────────────────────────

export async function updateApproval(
  approvalId: string,
  payload: UpdateApprovalPayload
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('approvals')
    .update({
      ...payload,
      approved_at: ['approved', 'approved_by_delegation', 'approved_pending_conditions']
        .includes(payload.status) ? new Date().toISOString() : undefined,
      denied_at: payload.status === 'denied' ? new Date().toISOString() : undefined,
    })
    .eq('id', approvalId)
    .select()
    .single()

  if (error) throw error
  return data as Approval
}

export async function getOverdueApprovals() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('approvals')
    .select('*, documents(campus_name, document_type_name, amount, state)')
    .eq('is_overdue', true)
    .eq('status', 'pending')
    .order('days_at_stage', { ascending: false })

  if (error) throw error
  return data
}

// ── Meetings ──────────────────────────────────────────────────

export async function getMeetings(type?: MeetingType) {
  const supabase = createClient()
  let query = supabase
    .from('meetings')
    .select('*')
    .order('meeting_date', { ascending: false })

  if (type) query = query.eq('meeting_type', type)

  const { data, error } = await query
  if (error) throw error
  return data as Meeting[]
}

export async function getUpcomingBODMeetings() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('meetings')
    .select(`
      *,
      bod_items(
        *,
        documents(campus_name, document_type_name, amount, state)
      )
    `)
    .eq('meeting_type', 'bod')
    .gte('meeting_date', new Date().toISOString().split('T')[0])
    .order('meeting_date', { ascending: true })
    .limit(5)

  if (error) throw error
  return data
}

export async function createMeeting(
  meetingDate: string,
  type: MeetingType,
  state?: StateRegion
): Promise<Meeting> {
  const supabase = createClient()

  const typeLabels: Record<MeetingType, string> = {
    fac_doc_rev: 'FAC Doc Rev',
    tactical: 'Tactical',
    bod: 'Board of Directors',
  }

  const dateLabel = new Date(meetingDate).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      meeting_date: meetingDate,
      meeting_type: type,
      state: state ?? null,
      title: `${typeLabels[type]} — ${dateLabel}`,
    })
    .select()
    .single()

  if (error) throw error
  return data as Meeting
}

// ── Tactical Items ────────────────────────────────────────────

export async function getTacticalItems(meetingId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tactical_items')
    .select('*, action_items(*)')
    .eq('meeting_id', meetingId)
    .order('agenda_number', { ascending: true })

  if (error) throw error
  return data as TacticalItem[]
}

export async function promoteTacticalToDocument(
  tacticalItemId: string,
  payload: SubmitDocumentPayload
): Promise<Document> {
  const doc = await submitDocument(payload)
  const supabase = createClient()
  await supabase
    .from('tactical_items')
    .update({
      promoted_to_document_id: doc.id,
      promoted_at: new Date().toISOString(),
    })
    .eq('id', tacticalItemId)

  return doc
}

// ── Action Items ──────────────────────────────────────────────

export async function getActionItems(filters?: {
  document_id?: string
  tactical_item_id?: string
  assigned_to_id?: string
  status?: string
}) {
  const supabase = createClient()
  let query = supabase
    .from('action_items')
    .select('*')
    .order('due_date', { ascending: true })

  if (filters?.document_id)     query = query.eq('document_id', filters.document_id)
  if (filters?.tactical_item_id) query = query.eq('tactical_item_id', filters.tactical_item_id)
  if (filters?.assigned_to_id)  query = query.eq('assigned_to_id', filters.assigned_to_id)
  if (filters?.status)          query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error
  return data as ActionItem[]
}

export async function createActionItem(payload: CreateActionItemPayload) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('action_items')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as ActionItem
}

export async function completeActionItem(actionItemId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('action_items')
    .update({
      status: 'complete',
      completed_at: new Date().toISOString(),
    })
    .eq('id', actionItemId)
    .select()
    .single()

  if (error) throw error
  return data as ActionItem
}

// ── BOD Items ─────────────────────────────────────────────────

export async function getPendingBODItems() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bod_items')
    .select(`
      *,
      documents(campus_name, document_type_name, amount, state, pipeline_status)
    `)
    .is('board_approved', null)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as (BodItem & { documents: Partial<Document> })[]
}

export async function updateBODItem(bodItemId: string, updates: Partial<BodItem>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bod_items')
    .update(updates)
    .eq('id', bodItemId)
    .select()
    .single()

  if (error) throw error
  return data as BodItem
}

// ── Reference Data ────────────────────────────────────────────

export async function getCampuses() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campuses')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function getDocumentTypes() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('document_types')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return data
}
