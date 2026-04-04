'use client'
// ============================================================
// HOPE BUILT ADVISORY — Meeting Mode
// The focused live note-taking view Vanessa opens at 2:30 PM
//
// Design principles:
//  - One document at a time, full focus
//  - Auto-saves every keystroke (debounced 800ms)
//  - Zero friction: no save buttons, no confirmations
//  - Keyboard navigable: Tab to next field, Enter to advance doc
//  - Large tap targets for outcome selection (laptop + tablet)
//  - Undo-safe: every save creates a snapshot in meeting_note_snapshots
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { updateDocument } from '@/lib/data'
import type { ActivePipelineItem, Meeting, PipelineStatus } from '@/types'
import { PIPELINE_STATUS_LABELS } from '@/types'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, Check, Clock, AlertCircle, Save } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface MeetingModeProps {
  meeting: Meeting
  documents: ActivePipelineItem[]
  userId: string
  onClose: () => void
}

interface LiveDoc extends ActivePipelineItem {
  _localNotes?:      string
  _localDiscussion?: string
  _localNextSteps?:  string
  _localOutcome?:    string
  _isDirty?:         boolean
  _lastSaved?:       Date
}

// ── FC Outcome options ────────────────────────────────────────

const FC_OUTCOMES = [
  { value: 'APPROVED',           label: '✅ Approved',               color: '#16a34a', bg: '#f0fdf4' },
  { value: 'ON HOLD',            label: '⏸ On Hold',                color: '#d97706', bg: '#fffbeb' },
  { value: 'DENIED',             label: '❌ Denied',                 color: '#dc2626', bg: '#fef2f2' },
  { value: 'APPROVED - PENDING', label: '🔵 Approved w/ Conditions', color: '#2563eb', bg: '#eff6ff' },
  { value: 'FOR INFO ONLY',      label: '📋 Info Only',              color: '#6b7280', bg: '#f9fafb' },
  { value: 'TABLED',             label: '⏭ Tabled',                 color: '#7c3aed', bg: '#f5f3ff' },
] as const

// ── Debounce hook ─────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

// ── Main Component ────────────────────────────────────────────

export default function MeetingMode({
  meeting,
  documents,
  userId,
  onClose,
}: MeetingModeProps) {
  const supabase = createClient()
  const [docs, setDocs] = useState<LiveDoc[]>(documents.map(d => ({
    ...d,
    _localNotes:      d.notes ?? '',
    _localDiscussion: d.discussion_notes ?? '',
    _localNextSteps:  d.next_steps ?? '',
    _localOutcome:    d.fc_outcome ?? '',
    _isDirty:         false,
  } as LiveDoc)))

  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionId,    setSessionId]     = useState<string | null>(null)
  const [saveStatus,   setSaveStatus]    = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const discussionRef = useRef<HTMLTextAreaElement>(null)

  const currentDoc = docs[currentIndex]

  // ── Session management ─────────────────────────────────────

  useEffect(() => {
    async function openSession() {
      const { data } = await supabase
        .from('meeting_sessions')
        .insert({
          org_id:     meeting.org_id ?? '',  // will be set by RLS
          meeting_id: meeting.id,
          opened_by:  userId,
          is_active:  true,
          current_doc_id: docs[0]?.id ?? null,
        })
        .select()
        .single()

      if (data) setSessionId(data.id)
    }
    openSession()

    return () => {
      // Close session on unmount
      if (sessionId) {
        supabase
          .from('meeting_sessions')
          .update({ is_active: false, closed_at: new Date().toISOString() })
          .eq('id', sessionId)
      }
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Update session's current_doc_id when we navigate
  useEffect(() => {
    if (!sessionId || !currentDoc) return
    supabase
      .from('meeting_sessions')
      .update({ current_doc_id: currentDoc.id })
      .eq('id', sessionId)
  }, [currentIndex, sessionId])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save logic ────────────────────────────────────────

  const debouncedNotes      = useDebounce(currentDoc?._localNotes,      800)
  const debouncedDiscussion = useDebounce(currentDoc?._localDiscussion, 800)
  const debouncedNextSteps  = useDebounce(currentDoc?._localNextSteps,  800)

  const saveField = useCallback(async (
    docId: string,
    field: string,
    value: string,
    previousValue: string
  ) => {
    if (value === previousValue) return

    setSaveStatus('saving')
    try {
      await updateDocument(docId, { [field]: value })

      // Write snapshot for undo safety
      await supabase.from('meeting_note_snapshots').insert({
        document_id:    docId,
        session_id:     sessionId,
        field_name:     field,
        previous_value: previousValue,
        new_value:      value,
        saved_by:       userId,
      })

      setDocs(prev => prev.map(d =>
        d.id === docId
          ? { ...d, _isDirty: false, _lastSaved: new Date() }
          : d
      ))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }, [sessionId, supabase, userId])

  // Fire auto-saves when debounced values change
  useEffect(() => {
    if (!currentDoc || !currentDoc._isDirty) return
    saveField(currentDoc.id, 'notes', debouncedNotes ?? '', currentDoc.notes ?? '')
  }, [debouncedNotes])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentDoc || !currentDoc._isDirty) return
    saveField(currentDoc.id, 'discussion_notes', debouncedDiscussion ?? '', currentDoc.discussion_notes ?? '')
  }, [debouncedDiscussion])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentDoc || !currentDoc._isDirty) return
    saveField(currentDoc.id, 'next_steps', debouncedNextSteps ?? '', currentDoc.next_steps ?? '')
  }, [debouncedNextSteps])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Field updaters ─────────────────────────────────────────

  function updateField(field: '_localNotes' | '_localDiscussion' | '_localNextSteps', value: string) {
    setDocs(prev => prev.map((d, i) =>
      i === currentIndex ? { ...d, [field]: value, _isDirty: true } : d
    ))
  }

  async function setOutcome(outcome: string) {
    const previous = currentDoc.fc_outcome ?? ''
    setDocs(prev => prev.map((d, i) =>
      i === currentIndex ? { ...d, _localOutcome: outcome, _isDirty: true } : d
    ))
    await saveField(currentDoc.id, 'fc_outcome', outcome, previous)
  }

  // ── Navigation ─────────────────────────────────────────────

  function navigate(direction: 'prev' | 'next') {
    const newIndex = direction === 'next'
      ? Math.min(currentIndex + 1, docs.length - 1)
      : Math.max(currentIndex - 1, 0)
    setCurrentIndex(newIndex)
    // Focus discussion field on new doc
    setTimeout(() => discussionRef.current?.focus(), 100)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); navigate('next') }
      if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); navigate('prev') }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentDoc) return null

  const progress = ((currentIndex + 1) / docs.length) * 100
  const currentOutcome = currentDoc._localOutcome

  return (
    <div style={styles.overlay}>

      {/* ── Top bar ── */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <div style={styles.meetingLabel}>
            🔴 LIVE — {meeting.title}
          </div>
          <div style={styles.meetingTime}>
            {format(new Date(meeting.meeting_date), 'EEEE, MMMM d, yyyy')}
          </div>
        </div>

        {/* Progress */}
        <div style={styles.progressWrap}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <div style={styles.progressLabel}>
            {currentIndex + 1} of {docs.length}
          </div>
        </div>

        {/* Save status */}
        <div style={styles.saveStatus}>
          {saveStatus === 'saving' && <><Clock size={14} /> Saving…</>}
          {saveStatus === 'saved'  && <><Save  size={14} color="#16a34a" /> Saved</>}
          {saveStatus === 'error'  && <><AlertCircle size={14} color="#dc2626" /> Save failed</>}
        </div>

        <button style={styles.closeBtn} onClick={onClose}>
          Exit Meeting Mode
        </button>
      </div>

      {/* ── Document header ── */}
      <div style={styles.docHeader}>
        <div style={styles.docMeta}>
          <span style={styles.docNum}>#{currentDoc.doc_number ?? currentIndex + 1}</span>
          <span style={{
            ...styles.statePill,
            background: currentDoc.state === 'TX' ? '#dbeafe' :
                        currentDoc.state === 'FL' ? '#dcfce7' : '#ede9fe',
            color:      currentDoc.state === 'TX' ? '#1e40af' :
                        currentDoc.state === 'FL' ? '#15803d' : '#6d28d9',
          }}>
            {currentDoc.state}
          </span>
          {currentDoc.submitter_type === 'pmsi' &&
            <span style={styles.pmsiTag}>PMSI</span>
          }
          {currentDoc.is_urgent &&
            <span style={styles.urgentTag}>🔥 URGENT</span>
          }
        </div>
        <div style={styles.docTitle}>{currentDoc.campus_name}</div>
        <div style={styles.docSubtitle}>
          {currentDoc.document_type_name}
          {currentDoc.amount != null && (
            <span style={styles.docAmount}>
              {currentDoc.amount < 0
                ? ` — ($${Math.abs(currentDoc.amount).toLocaleString()})`
                : ` — $${currentDoc.amount.toLocaleString()}`}
            </span>
          )}
        </div>
        {currentDoc.funding_source && (
          <div style={styles.docFunding}>📋 {currentDoc.funding_source}</div>
        )}
      </div>

      {/* ── Main editing area ── */}
      <div style={styles.editArea}>

        {/* Description (read-only during meeting) */}
        <div style={styles.descriptionBox}>
          <div style={styles.fieldLabel}>Description</div>
          <div style={styles.descriptionText}>
            {currentDoc.description || <em style={{ color: '#9ca3af' }}>No description</em>}
          </div>
        </div>

        {/* Notes (from previous meetings / context) */}
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Notes / Context</label>
          <textarea
            style={styles.textarea}
            value={currentDoc._localNotes ?? ''}
            onChange={e => updateField('_localNotes', e.target.value)}
            placeholder="Background, context, or previous discussion…"
            rows={3}
          />
        </div>

        {/* Discussion notes — primary live-typing field */}
        <div style={styles.fieldGroup}>
          <label style={{ ...styles.fieldLabel, color: '#2563eb' }}>
            💬 Discussion Notes <span style={styles.liveHint}>(typing here live)</span>
          </label>
          <textarea
            ref={discussionRef}
            style={{ ...styles.textarea, ...styles.primaryTextarea }}
            value={currentDoc._localDiscussion ?? ''}
            onChange={e => updateField('_localDiscussion', e.target.value)}
            placeholder="Type discussion notes as the meeting happens…"
            rows={5}
            autoFocus
          />
        </div>

        {/* Next Steps */}
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Next Steps</label>
          <textarea
            style={styles.textarea}
            value={currentDoc._localNextSteps ?? ''}
            onChange={e => updateField('_localNextSteps', e.target.value)}
            placeholder="Who does what by when…"
            rows={3}
          />
        </div>

        {/* FC Outcome — big tap targets */}
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>F&C Committee Outcome</label>
          <div style={styles.outcomeGrid}>
            {FC_OUTCOMES.map(opt => (
              <button
                key={opt.value}
                style={{
                  ...styles.outcomeBtn,
                  background:   currentOutcome === opt.value ? opt.bg  : '#f9fafb',
                  borderColor:  currentOutcome === opt.value ? opt.color : '#e5e7eb',
                  color:        currentOutcome === opt.value ? opt.color : '#374151',
                  fontWeight:   currentOutcome === opt.value ? 700 : 500,
                  transform:    currentOutcome === opt.value ? 'scale(1.03)' : 'scale(1)',
                }}
                onClick={() => setOutcome(opt.value)}
              >
                {currentOutcome === opt.value && (
                  <Check size={14} style={{ marginRight: 4 }} />
                )}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── Navigation footer ── */}
      <div style={styles.navBar}>
        {/* Doc list thumbnails */}
        <div style={styles.docList}>
          {docs.map((d, i) => (
            <button
              key={d.id}
              style={{
                ...styles.docThumb,
                background:  i === currentIndex ? '#1e40af' : d._localOutcome ? '#f0fdf4' : '#f9fafb',
                borderColor: i === currentIndex ? '#1e40af' : d._localOutcome ? '#16a34a' : '#e5e7eb',
                color:       i === currentIndex ? '#fff'    : d._localOutcome ? '#15803d' : '#374151',
              }}
              onClick={() => setCurrentIndex(i)}
              title={d.campus_name ?? ''}
            >
              {i + 1}
              {d._localOutcome && <div style={styles.thumbDot} />}
            </button>
          ))}
        </div>

        {/* Prev / Next */}
        <div style={styles.navBtns}>
          <button
            style={{ ...styles.navBtn, opacity: currentIndex === 0 ? 0.3 : 1 }}
            onClick={() => navigate('prev')}
            disabled={currentIndex === 0}
          >
            <ChevronLeft size={20} /> Previous
            <div style={styles.keyHint}>Alt ←</div>
          </button>

          <button
            style={{
              ...styles.navBtn,
              ...styles.navBtnPrimary,
              opacity: currentIndex === docs.length - 1 ? 0.3 : 1,
            }}
            onClick={() => navigate('next')}
            disabled={currentIndex === docs.length - 1}
          >
            Next <ChevronRight size={20} />
            <div style={styles.keyHint}>Alt →</div>
          </button>
        </div>
      </div>

    </div>
  )
}

// ── Inline styles (intentional — no Tailwind class parsing in meeting mode) ──

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 9999,
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  topBar: {
    height: 52,
    background: '#1e293b',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 16,
    flexShrink: 0,
  },
  topBarLeft: { display: 'flex', flexDirection: 'column' as const, gap: 1 },
  meetingLabel: { fontSize: 12, fontWeight: 700, color: '#f87171', letterSpacing: '0.05em' },
  meetingTime:  { fontSize: 11, color: '#64748b' },
  progressWrap: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 300 },
  progressBar:  { flex: 1, height: 4, background: '#334155', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#3b82f6', borderRadius: 2, transition: 'width 0.3s' },
  progressLabel:{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' as const },
  saveStatus:   { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8', minWidth: 80 },
  closeBtn: {
    marginLeft: 'auto',
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: 6,
    color: '#94a3b8',
    fontSize: 12,
    cursor: 'pointer',
  },
  docHeader: {
    padding: '16px 24px 12px',
    background: '#1e293b',
    borderBottom: '1px solid #334155',
    flexShrink: 0,
  },
  docMeta:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  docNum:     { fontSize: 12, fontWeight: 700, color: '#64748b', fontFamily: 'monospace' },
  statePill:  { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 },
  pmsiTag:    { fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: '#fef3c7', color: '#92400e' },
  urgentTag:  { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' },
  docTitle:   { fontSize: 22, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2 },
  docSubtitle:{ fontSize: 14, color: '#94a3b8', marginTop: 2 },
  docAmount:  { color: '#f59e0b', fontWeight: 600 },
  docFunding: { fontSize: 12, color: '#64748b', marginTop: 4 },
  editArea: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },
  descriptionBox: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '10px 14px',
  },
  descriptionText: { fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginTop: 4 },
  fieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
  liveHint:   { textTransform: 'none' as const, fontWeight: 400, fontSize: 10, color: '#3b82f6', marginLeft: 6 },
  textarea: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#f1f5f9',
    fontSize: 13,
    lineHeight: 1.5,
    resize: 'vertical' as const,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  primaryTextarea: {
    border: '2px solid #3b82f6',
    background: '#0f172a',
    fontSize: 14,
  },
  outcomeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  outcomeBtn: {
    padding: '12px 8px',
    borderRadius: 8,
    border: '2px solid',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: {
    height: 64,
    background: '#1e293b',
    borderTop: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 12,
    flexShrink: 0,
  },
  docList: { display: 'flex', gap: 4, flex: 1, overflow: 'auto', alignItems: 'center' },
  docThumb: {
    width: 32, height: 32,
    borderRadius: 6,
    border: '2px solid',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    flexShrink: 0,
    fontFamily: 'monospace',
    transition: 'all 0.15s',
  },
  thumbDot: {
    position: 'absolute' as const,
    top: -3, right: -3,
    width: 8, height: 8,
    borderRadius: '50%',
    background: '#16a34a',
    border: '1.5px solid #1e293b',
  },
  navBtns:       { display: 'flex', gap: 8, flexShrink: 0 },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: '#334155',
    border: 'none',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    position: 'relative' as const,
  },
  navBtnPrimary: { background: '#3b82f6', color: '#fff' },
  keyHint: {
    position: 'absolute' as const,
    bottom: -16,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 9,
    color: '#475569',
    whiteSpace: 'nowrap' as const,
  },
} as const
