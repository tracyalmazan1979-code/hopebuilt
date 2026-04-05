'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { updateApproval, createActionItem, updateDocument } from '@/lib/data'
import type { DocumentWithApprovals, User, Approval, ApprovalStatus } from '@/types'
import {
  PipelineBadge, FileBadge, StateBadge, ApprovalTimeline,
  ActionItemsList, SectionCard, Amount, PageHeader,
} from '@/components/ui'
import { format } from 'date-fns'
import {
  FileDown, ExternalLink, Plus, Check, X, Edit2,
  AlertTriangle, Archive, PauseCircle,
} from 'lucide-react'
import { clsx } from 'clsx'

// ── Approval Update Modal ─────────────────────────────────────

function ApprovalModal({
  approval,
  onClose,
  onSaved,
}: {
  approval: Approval
  onClose:  () => void
  onSaved:  () => void
}) {
  const [status,  setStatus]  = useState<ApprovalStatus>(approval.status)
  const [notes,   setNotes]   = useState(approval.notes ?? '')
  const [conditions, setConditions] = useState(approval.conditions ?? '')
  const [ticket,  setTicket]  = useState(approval.ticket_number ?? '')
  const [saving,  setSaving]  = useState(false)

  async function save() {
    setSaving(true)
    await updateApproval(approval.id, { status, notes, conditions, ticket_number: ticket })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface border border-strong rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-default">
          <div>
            <div className="font-syne font-bold text-sm text-default">Update Approval</div>
            <div className="text-xs text-muted mt-0.5">{approval.stage.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())} stage</div>
          </div>
          <button onClick={onClose} className="text-dim hover:text-default"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ApprovalStatus)}
              className="input-base"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="approved_by_delegation">Approved by Delegation</option>
              <option value="approved_pending_conditions">Approved — Pending Conditions</option>
              <option value="on_hold">On Hold</option>
              <option value="denied">Denied</option>
              <option value="not_required">Not Required</option>
            </select>
          </div>
          {status === 'approved_pending_conditions' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Conditions</label>
              <textarea className="input-base" rows={2} value={conditions} onChange={e => setConditions(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Legal Ticket # (if applicable)</label>
            <input className="input-base" value={ticket} onChange={e => setTicket(e.target.value)} placeholder="Ticket #1234567" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Notes</label>
            <textarea className="input-base" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-default">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted border border-default rounded-md hover:text-default">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold bg-amber-500 text-black rounded-md hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Action Item ───────────────────────────────────────────

function AddActionItemForm({
  documentId,
  onAdded,
  onClose,
}: {
  documentId: string
  onAdded:    () => void
  onClose:    () => void
}) {
  const [desc,     setDesc]     = useState('')
  const [assigned, setAssigned] = useState('')
  const [due,      setDue]      = useState('')
  const [priority, setPriority] = useState<'urgent'|'high'|'medium'|'low'>('medium')
  const [saving,   setSaving]   = useState(false)

  async function save() {
    if (!desc.trim()) return
    setSaving(true)
    await createActionItem({
      document_id:      documentId,
      description:      desc,
      assigned_to_name: assigned || undefined,
      due_date:         due || undefined,
      priority,
    })
    setSaving(false)
    onAdded()
    onClose()
  }

  return (
    <div className="space-y-3 p-3 rounded-md bg-surface-2 border border-default mt-2">
      <textarea
        className="input-base text-sm"
        rows={2}
        placeholder="Action item description…"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        autoFocus
      />
      <div className="grid grid-cols-3 gap-2">
        <input className="input-base text-xs" placeholder="Assigned to…" value={assigned} onChange={e => setAssigned(e.target.value)} />
        <input className="input-base text-xs" type="date" value={due} onChange={e => setDue(e.target.value)} />
        <select className="input-base text-xs" value={priority} onChange={e => setPriority(e.target.value as any)}>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">⚪ Low</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !desc.trim()} className="px-3 py-1.5 text-xs font-bold bg-amber-500 text-black rounded-md hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1">
          <Check size={12} /> {saving ? 'Adding…' : 'Add'}
        </button>
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-muted hover:text-default"><X size={12} /></button>
      </div>
    </div>
  )
}

// ── Main Detail Component ─────────────────────────────────────

export function DocumentDetailClient({
  document: doc,
  currentUser,
}: {
  document:    DocumentWithApprovals & { meetings: any }
  currentUser: User
}) {
  const router       = useRouter()
  const params       = useSearchParams()
  const qc           = useQueryClient()
  const [editApproval,    setEditApproval]    = useState<Approval | null>(null)
  const [showAddAction,   setShowAddAction]   = useState(false)
  const [generatingCAF,   setGeneratingCAF]   = useState(false)
  const [localActionItems, setLocalActionItems] = useState(doc.action_items ?? [])

  const justSubmitted = params.get('submitted') === '1'

  async function generateCAF() {
    setGeneratingCAF(true)
    const res = await fetch(`/api/documents/${doc.id}/generate-caf`, { method: 'POST' })
    const data = await res.json()
    setGeneratingCAF(false)
    if (data.caf_pdf_url) window.open(data.caf_pdf_url, '_blank')
  }

  const canApprove = ['admin','coordinator','approver','leadership'].includes(currentUser.role)

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Just submitted banner */}
      {justSubmitted && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20 animate-fade-in">
          <Check size={18} className="text-green-400" />
          <div>
            <div className="text-sm font-semibold text-green-400">Document submitted successfully</div>
            <div className="text-xs text-muted">Vanessa and Sylvia have been notified by email.</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StateBadge state={doc.state} />
              {doc.submitter_type === 'pmsi' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">PMSI</span>
              )}
              {doc.is_urgent && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">🔥 URGENT</span>
              )}
              <PipelineBadge status={doc.pipeline_status} />
              <FileBadge status={doc.file_status} />
            </div>
            <h1 className="font-syne font-black text-2xl text-default">{doc.campus_name}</h1>
            <div className="text-sm text-muted mt-1">
              {doc.document_type_name}
              {doc.doc_number && <span className="text-dim"> · Item #{doc.doc_number}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {doc.sharepoint_folder_url && (
              <a
                href={doc.sharepoint_folder_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted border border-default rounded-md hover:text-default hover:border-strong transition-colors"
              >
                <ExternalLink size={13} /> SharePoint
              </a>
            )}
            <button
              onClick={generateCAF}
              disabled={generatingCAF}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-400 border border-amber-500/30 bg-amber-500/8 rounded-md hover:bg-amber-500/15 transition-colors disabled:opacity-50"
            >
              <FileDown size={13} /> {generatingCAF ? 'Generating…' : doc.caf_pdf_url ? 'Regenerate CAF' : 'Generate CAF'}
            </button>
            {doc.caf_pdf_url && (
              <a
                href={`/api/documents/${doc.id}/generate-caf`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-400 border border-green-500/20 bg-green-500/8 rounded-md hover:bg-green-500/15 transition-colors"
              >
                <FileDown size={13} /> Download CAF
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[1fr_340px] gap-6">

        {/* Left column */}
        <div className="space-y-5">

          {/* Key details */}
          <SectionCard title="Document Details">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ['Amount',         <Amount key="a" value={doc.amount} />],
                ['Funding Source', doc.funding_source],
                ['Funding Request',doc.funding_request],
                ['Presenter',      doc.presenter_name],
                ['Requester',      [doc.requester_name, doc.requester_title].filter(Boolean).join(' · ')],
                ['Organization',   doc.organization],
                ['Vendor',         doc.vendor_name],
                ['CO-OP',          doc.is_coop_member ? `Yes — ${doc.coop_name ?? ''}` : doc.is_coop_member === false ? 'No' : null],
                ['Students on Campus', doc.students_on_campus == null ? null : doc.students_on_campus ? 'Yes ⚠' : 'No'],
                ['Service Dates',  doc.service_start_date ? `${format(new Date(doc.service_start_date), 'MM/dd/yy')} → ${doc.service_end_date ? format(new Date(doc.service_end_date), 'MM/dd/yy') : 'TBD'}` : null],
                ['GL Account',     doc.gl_account],
                ['Legal Ticket',   doc.legal_ticket_number],
                ['FAC Meeting',    doc.meetings?.title ?? doc.meetings?.meeting_date],
                ['Submitted',      doc.submitted_at ? format(new Date(doc.submitted_at), 'MM/dd/yyyy') : null],
                ['Date Needed By', doc.date_needed_by ? format(new Date(doc.date_needed_by), 'MM/dd/yyyy') : null],
              ].filter(([,v]) => v != null).map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-[10px] font-semibold text-dim uppercase tracking-wider mb-0.5">{label}</dt>
                  <dd className="text-[13px] text-default">{value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          {/* Description */}
          {doc.description && (
            <SectionCard title="Description of Services">
              <p className="text-sm text-default leading-relaxed whitespace-pre-wrap">{doc.description}</p>
            </SectionCard>
          )}

          {/* Notes */}
          {(doc.notes || doc.discussion_notes || doc.next_steps || doc.layne_notes) && (
            <SectionCard title="Notes & Discussion">
              {doc.notes && (
                <div className="mb-3">
                  <div className="text-[10px] font-bold text-dim uppercase tracking-wider mb-1">Notes</div>
                  <p className="text-sm text-default leading-relaxed whitespace-pre-wrap">{doc.notes}</p>
                </div>
              )}
              {doc.discussion_notes && (
                <div className="mb-3">
                  <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">FAC Discussion</div>
                  <p className="text-sm text-default leading-relaxed whitespace-pre-wrap">{doc.discussion_notes}</p>
                </div>
              )}
              {doc.next_steps && (
                <div className="mb-3">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Next Steps</div>
                  <p className="text-sm text-default leading-relaxed whitespace-pre-wrap">{doc.next_steps}</p>
                </div>
              )}
              {doc.layne_notes && (
                <div>
                  <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Layne's Notes</div>
                  <p className="text-sm text-default leading-relaxed whitespace-pre-wrap">{doc.layne_notes}</p>
                </div>
              )}
            </SectionCard>
          )}

          {/* Action Items */}
          <SectionCard
            title="Action Items"
            action={
              <button
                onClick={() => setShowAddAction(true)}
                className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
              >
                <Plus size={12} /> Add
              </button>
            }
          >
            {showAddAction && (
              <AddActionItemForm
                documentId={doc.id}
                onAdded={() => setLocalActionItems(prev => [...prev])}
                onClose={() => setShowAddAction(false)}
              />
            )}
            <div className={showAddAction ? 'mt-3' : ''}>
              <ActionItemsList
                items={localActionItems}
                onItemCompleted={id => setLocalActionItems(prev =>
                  prev.map(i => i.id === id ? { ...i, status: 'complete' } : i)
                )}
              />
            </div>
          </SectionCard>

        </div>

        {/* Right column — approval pipeline */}
        <div className="space-y-5">
          <SectionCard title="Approval Pipeline">
            <ApprovalTimeline approvals={doc.approvals ?? []} />
            {canApprove && (
              <div className="mt-4 pt-4 border-t border-default space-y-2">
                <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">Update an Approval</div>
                {(doc.approvals ?? []).filter(a => a.status === 'pending' && a.is_required).map(approval => (
                  <button
                    key={approval.id}
                    onClick={() => setEditApproval(approval)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-surface-2 border border-default hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors text-xs"
                  >
                    <span className="text-muted">{approval.stage.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    <span className="text-amber-400 font-semibold">Update →</span>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {/* BOD Info */}
          {doc.bod_item && (
            <SectionCard title="Board of Directors">
              <dl className="space-y-2">
                <div>
                  <dt className="text-[10px] text-dim uppercase tracking-wider">Board Entity</dt>
                  <dd className="text-sm text-default">{doc.bod_item.board_entity ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-dim uppercase tracking-wider">Item Type</dt>
                  <dd className="text-sm text-default">{doc.bod_item.item_type?.replace(/_/g,' ')}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-dim uppercase tracking-wider">Board Approved</dt>
                  <dd className="text-sm">
                    {doc.bod_item.board_approved === true  && <span className="text-green-400 font-semibold">✓ Approved</span>}
                    {doc.bod_item.board_approved === false && <span className="text-red-400">✗ Denied</span>}
                    {doc.bod_item.board_approved == null   && <span className="text-amber-400">Pending</span>}
                  </dd>
                </div>
                {doc.bod_item.resolution_number && (
                  <div>
                    <dt className="text-[10px] text-dim uppercase tracking-wider">Resolution #</dt>
                    <dd className="text-sm font-mono text-default">{doc.bod_item.resolution_number}</dd>
                  </div>
                )}
              </dl>
            </SectionCard>
          )}

          {/* Quick actions */}
          <SectionCard title="Actions">
            <div className="space-y-2">
              {doc.is_on_hold ? (
                <button className="w-full px-3 py-2 text-xs text-green-400 border border-green-500/20 rounded-md hover:bg-green-500/10 transition-colors">
                  Reactivate Item
                </button>
              ) : (
                <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-orange-400 border border-orange-500/20 rounded-md hover:bg-orange-500/10 transition-colors">
                  <PauseCircle size={13} /> Put on Hold
                </button>
              )}
              {!doc.is_archived && (
                <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-dim border border-default rounded-md hover:text-muted hover:border-strong transition-colors">
                  <Archive size={13} /> Archive Document
                </button>
              )}
            </div>
          </SectionCard>

          {/* Metadata */}
          <SectionCard title="Record Info">
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-dim">Created</dt>
                <dd className="text-muted font-mono">{format(new Date(doc.created_at), 'MM/dd/yy')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-dim">Updated</dt>
                <dd className="text-muted font-mono">{format(new Date(doc.updated_at), 'MM/dd/yy h:mm a')}</dd>
              </div>
              {doc.caf_generated_at && (
                <div className="flex justify-between">
                  <dt className="text-dim">CAF Generated</dt>
                  <dd className="text-muted font-mono">{format(new Date(doc.caf_generated_at), 'MM/dd/yy')}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-dim">Submitter</dt>
                <dd className="text-muted">{doc.submitter_type === 'pmsi' ? 'PMSI' : 'IDEA Internal'}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>

      {/* Approval modal */}
      {editApproval && (
        <ApprovalModal
          approval={editApproval}
          onClose={() => setEditApproval(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['document', doc.id] })
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
