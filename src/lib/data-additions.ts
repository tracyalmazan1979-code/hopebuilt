// ============================================================
// HOPE BUILT ADVISORY — Data Layer Additions (Migration 004)
// Add these exports to src/lib/data.ts
// ============================================================

// ── Add to existing data.ts ───────────────────────────────────
// These functions handle the new fields from migration 004.
// Copy into data.ts alongside the existing exports.

import { createClient } from '@/lib/supabase'
import type { ApprovalStage } from '@/types'

// ── Meeting notes (written during FAC Meeting Mode) ───────────

export async function saveMeetingNotes(
  documentId: string,
  fields: {
    discussion_notes?: string
    next_steps?:       string
    fc_outcome?:       string
    notes?:            string
  }
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('documents')
    .update({
      ...fields,
      ...(fields.fc_outcome ? { fc_outcome_at: new Date().toISOString() } : {}),
    })
    .eq('id', documentId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Approval token operations ─────────────────────────────────

export async function sendApprovalEmail(
  approvalId:    string,
  documentId:    string,
  approverName:  string,
  approverEmail: string,
  stage:         ApprovalStage
) {
  const res = await fetch('/api/approve', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'internal' },
    body: JSON.stringify({ approval_id: approvalId, document_id: documentId, approver_name: approverName, approver_email: approverEmail, stage }),
  })
  return res.json()
}

// ── File status update ────────────────────────────────────────

export async function markFileReceived(documentId: string, fileUrl: string) {
  const supabase = createClient()
  return supabase
    .from('documents')
    .update({
      file_status:     'received',
      file_url:        fileUrl,
      file_received_at: new Date().toISOString(),
    })
    .eq('id', documentId)
}

// ── Predoc status update ──────────────────────────────────────

export async function updatePredocStatus(
  documentId: string,
  status: 'not_scheduled' | 'pending_predoc' | 'corrections_needed' | 'cleared_for_fac',
  correctionText?: string,
  flaggedByName?:  string
) {
  const supabase = createClient()

  await supabase
    .from('documents')
    .update({
      predoc_status:    status,
      predoc_reviewed_at: status === 'cleared_for_fac' ? new Date().toISOString() : undefined,
      predoc_cleared_at:  status === 'cleared_for_fac' ? new Date().toISOString() : undefined,
    })
    .eq('id', documentId)

  if (status === 'corrections_needed' && correctionText) {
    await supabase.from('predoc_corrections').insert({
      document_id:     documentId,
      correction_text: correctionText,
      flagged_by_name: flaggedByName,
    })
  }
}
