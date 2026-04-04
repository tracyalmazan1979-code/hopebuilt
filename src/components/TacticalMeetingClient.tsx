'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { updateDocument } from '@/lib/data'
import { createClient } from '@/lib/supabase'
import type { User } from '@/types'
import { PipelineBadge, FileBadge, StateBadge, Amount, EmptyState, PageHeader } from '@/components/ui'
import { format } from 'date-fns'
import { Calendar, ChevronRight, Check, Plus, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'

const LAYNE_OUTCOMES = [
  { value: 'APPROVED',    label: '✅ Approved',      color: 'green' },
  { value: 'QUESTIONS',   label: '❓ Has Questions',  color: 'amber' },
  { value: 'ON HOLD',     label: '⏸ Hold',           color: 'orange' },
  { value: 'DENIED',      label: '❌ Denied',        color: 'red' },
  { value: 'NOTE ONLY',   label: '📋 Note Only',     color: 'dim' },
]

export function TacticalMeetingClient({
  meetings,
  selectedMeetingId,
  tacticalItems,
  facDocuments,
  currentUser,
}: {
  meetings:          any[]
  selectedMeetingId?: string
  tacticalItems:     any[]
  facDocuments:      any[]
  currentUser:       User
}) {
  const router = useRouter()
  const [layneNotes,   setLayneNotes]   = useState<Record<string, string>>({})
  const [layneOutcomes, setLayneOutcomes] = useState<Record<string, string>>({})
  const [saving,       setSaving]       = useState<Record<string, boolean>>({})
  const [saved,        setSaved]        = useState<Record<string, boolean>>({})

  const tacticalMeetings = meetings.filter(m => m.meeting_type === 'tactical')
  const facMeetings      = meetings.filter(m => m.meeting_type === 'fac_doc_rev')

  // FAC carryover items (from facDocuments)
  const carryoverItems = facDocuments

  // Tactical-only items
  const tacticalOnly = tacticalItems.filter(i => i.item_source === 'tactical_only')

  async function saveLayne(docId: string) {
    setSaving(prev => ({ ...prev, [docId]: true }))
    await updateDocument(docId, {
      layne_notes:   layneNotes[docId] ?? undefined,
      layne_outcome: layneOutcomes[docId] ?? undefined,
      layne_reviewed_at: new Date().toISOString(),
    } as any)
    setSaving(prev => ({ ...prev, [docId]: false }))
    setSaved(prev => ({ ...prev, [docId]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [docId]: false })), 2000)
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* Meeting selector sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-default overflow-y-auto">
        <div className="p-4">
          <div className="section-title mb-3">Tactical Meetings</div>
          <div className="space-y-1">
            {tacticalMeetings.length === 0 ? (
              <p className="text-xs text-dim">No tactical meetings yet</p>
            ) : tacticalMeetings.map(m => (
              <Link
                key={m.id}
                href={`/meetings/tactical?meeting=${m.id}`}
                className={clsx(
                  'flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors',
                  selectedMeetingId === m.id
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    : 'text-muted hover:bg-surface-2 hover:text-default'
                )}
              >
                <div>
                  <div className="font-semibold">{format(new Date(m.meeting_date), 'MMM d, yyyy')}</div>
                  <div className="text-[10px] text-dim mt-0.5">
                    {m.tactical_items?.[0]?.count ?? 0} items
                  </div>
                </div>
                <ChevronRight size={12} />
              </Link>
            ))}
          </div>

          <div className="section-title mt-5 mb-3">FAC Meetings</div>
          <div className="space-y-1">
            {facMeetings.slice(0,5).map(m => (
              <div key={m.id} className="px-3 py-2 rounded-md text-xs text-dim">
                {format(new Date(m.meeting_date), 'MMM d')} — {m.title?.replace('Facilities and Construction Doc Rev- ','') ?? ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedMeetingId ? (
          <EmptyState
            icon="🗓"
            title="Select a Tactical Meeting"
            description="Choose a meeting from the sidebar to view the agenda and FAC carryover items."
          />
        ) : (
          <div className="max-w-4xl space-y-8">

            {/* FAC Carryover Section */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-surface-3" />
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                    FAC Carryover — {carryoverItems.length} item{carryoverItems.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-px flex-1 bg-surface-3" />
              </div>
              <p className="text-xs text-dim mb-4 text-center">
                Auto-populated from this week's FAC meeting. Set Layne's outcome and notes for each.
              </p>

              {carryoverItems.length === 0 ? (
                <div className="card p-6 text-center">
                  <p className="text-sm text-muted">No FAC documents linked to this tactical meeting yet.</p>
                  <p className="text-xs text-dim mt-1">Link a FAC meeting to this tactical meeting to auto-populate items.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {carryoverItems.map((doc, i) => {
                    const docLayneOutcome = layneOutcomes[doc.id] ?? doc.layne_outcome ?? ''
                    const docLayneNotes   = layneNotes[doc.id]   ?? doc.layne_notes ?? ''
                    const isSaving = saving[doc.id]
                    const isSaved  = saved[doc.id]

                    return (
                      <div key={doc.id} className="card overflow-hidden">
                        {/* Item header */}
                        <div className="flex items-start gap-3 p-4 border-b border-default">
                          <div className="font-mono text-xs text-dim w-6 flex-shrink-0 pt-0.5">
                            #{i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <StateBadge state={doc.state} />
                              {doc.submitter_type === 'pmsi' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">PMSI</span>
                              )}
                              <PipelineBadge status={doc.pipeline_status} />
                              {doc.file_status === 'pending_doc' && <FileBadge status="pending_doc" />}
                            </div>
                            <Link href={`/documents/${doc.id}`} className="font-semibold text-sm text-default hover:text-amber-400 transition-colors">
                              {doc.campus_name}
                            </Link>
                            <div className="text-xs text-muted">{doc.document_type_name}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Amount value={doc.amount} />
                            {doc.fc_outcome && (
                              <div className={clsx('text-[10px] font-bold mt-1', {
                                'text-green-400':  doc.fc_outcome.includes('APPROVED'),
                                'text-orange-400': doc.fc_outcome === 'ON HOLD',
                                'text-red-400':    doc.fc_outcome === 'DENIED',
                              })}>
                                FC: {doc.fc_outcome}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Layne review area */}
                        <div className="p-4 bg-surface-2/50">
                          <div className="section-title mb-3">Layne's Review</div>

                          {/* Outcome buttons */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {LAYNE_OUTCOMES.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => setLayneOutcomes(prev => ({
                                  ...prev,
                                  [doc.id]: prev[doc.id] === opt.value ? '' : opt.value,
                                }))}
                                className={clsx(
                                  'px-3 py-1.5 rounded-md text-xs font-semibold border transition-all',
                                  docLayneOutcome === opt.value ? {
                                    green:  'bg-green-500/15 border-green-500/30 text-green-400',
                                    amber:  'bg-amber-500/15 border-amber-500/30 text-amber-400',
                                    orange: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
                                    red:    'bg-red-500/15 border-red-500/30 text-red-400',
                                    dim:    'bg-surface-3 border-strong text-muted',
                                  }[opt.color] : 'bg-surface border-default text-muted hover:text-default hover:border-strong'
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {/* Notes */}
                          <div className="flex gap-3">
                            <textarea
                              className="input-base text-xs flex-1"
                              rows={2}
                              placeholder="Layne's notes or questions…"
                              value={docLayneNotes}
                              onChange={e => setLayneNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                            />
                            <button
                              onClick={() => saveLayne(doc.id)}
                              disabled={isSaving}
                              className={clsx(
                                'flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1',
                                isSaved
                                  ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                                  : 'bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50'
                              )}
                            >
                              {isSaved ? <><Check size={12} /> Saved</> : isSaving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Tactical-only items */}
            {tacticalOnly.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-surface-3" />
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                    <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                      Tactical Agenda — {tacticalOnly.length} item{tacticalOnly.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-surface-3" />
                </div>

                <div className="space-y-2">
                  {tacticalOnly.map((item, i) => (
                    <div key={item.id} className="card p-4">
                      <div className="flex items-start gap-3">
                        <div className="font-mono text-xs text-dim w-6 flex-shrink-0">{item.agenda_number ?? i + 1}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {item.state && <StateBadge state={item.state} />}
                          </div>
                          <div className="font-semibold text-sm text-default">{item.campus_name}</div>
                          {item.subtopic && <div className="text-xs text-muted">{item.subtopic}</div>}
                          {item.description && (
                            <div className="text-xs text-dim mt-2 leading-relaxed">{item.description}</div>
                          )}
                          {item.discussion_notes && (
                            <div className="mt-2 p-2 rounded bg-blue-500/5 border border-blue-500/10">
                              <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Notes</div>
                              <div className="text-xs text-muted">{item.discussion_notes}</div>
                            </div>
                          )}
                          {item.fc_outcome && (
                            <div className="mt-1">
                              <span className={clsx('text-[11px] font-bold', {
                                'text-green-400': item.fc_outcome.includes('APPROVED'),
                                'text-orange-400': item.fc_outcome === 'ON HOLD',
                              })}>
                                Outcome: {item.fc_outcome}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
