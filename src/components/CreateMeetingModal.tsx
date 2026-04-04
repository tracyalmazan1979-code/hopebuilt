'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MeetingType, StateRegion } from '@/types'
import { X, Plus } from 'lucide-react'
import { clsx } from 'clsx'

interface CreateMeetingModalProps {
  defaultType?: MeetingType
  facMeetings?: { id: string; title: string | null; meeting_date: string }[]
  onClose: () => void
  onCreated?: (meetingId: string) => void
}

export function CreateMeetingModal({
  defaultType = 'fac_doc_rev',
  facMeetings = [],
  onClose,
  onCreated,
}: CreateMeetingModalProps) {
  const router   = useRouter()
  const [type,    setType]    = useState<MeetingType>(defaultType)
  const [date,    setDate]    = useState(() => {
    // Default to next Wednesday
    const today = new Date()
    const day   = today.getDay()
    const diff  = (3 - day + 7) % 7 || 7
    const next  = new Date(today)
    next.setDate(today.getDate() + diff)
    return next.toISOString().split('T')[0]
  })
  const [state,       setState]       = useState<StateRegion | ''>('TX')
  const [linkedFAC,   setLinkedFAC]   = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleCreate() {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/meetings/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_date:          date,
          meeting_type:          type,
          state:                 state || undefined,
          linked_fac_meeting_id: linkedFAC || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to create meeting')
        return
      }

      onCreated?.(data.meeting.id)
      router.refresh()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: { value: MeetingType; label: string }[] = [
    { value: 'fac_doc_rev', label: 'FAC Document Review (Wednesday 2:30 PM)' },
    { value: 'tactical',    label: 'Tactical Meeting' },
    { value: 'predoc_pmsi', label: 'PMSI PreDoc Review (Wednesday 9:00 AM)' },
    { value: 'predoc_idea', label: 'IDEA Internal PreDoc Review' },
    { value: 'bod',         label: 'Board of Directors Session' },
    { value: 'layne_solo_review', label: 'Layne Solo Review (no Tactical meeting)' },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface border border-strong rounded-xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-default">
          <div>
            <div className="font-syne font-bold text-sm text-default">Create Meeting</div>
            <div className="text-xs text-muted mt-0.5">Add a new meeting to the schedule</div>
          </div>
          <button onClick={onClose} className="text-dim hover:text-default transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Meeting Type <span className="text-amber-400">*</span>
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value as MeetingType)}
              className="input-base"
            >
              {typeOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input-base"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">State</label>
              <select
                value={state}
                onChange={e => setState(e.target.value as StateRegion | '')}
                className="input-base"
              >
                <option value="">All</option>
                <option value="TX">TX</option>
                <option value="FL">FL (IPS)</option>
                <option value="OH">OH (IPS)</option>
              </select>
            </div>
          </div>

          {/* Link to FAC meeting (for Tactical) */}
          {(type === 'tactical' || type === 'layne_solo_review') && facMeetings.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Link to FAC Meeting
              </label>
              <select
                value={linkedFAC}
                onChange={e => setLinkedFAC(e.target.value)}
                className="input-base"
              >
                <option value="">— Select FAC meeting to link —</option>
                {facMeetings.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.title ?? m.meeting_date}
                  </option>
                ))}
              </select>
              {linkedFAC && type === 'tactical' && (
                <p className="text-[11px] text-green-400">
                  ✓ FAC documents will be auto-populated into this Tactical meeting
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-default">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted border border-default rounded-md hover:text-default transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting || !date}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            {submitting ? 'Creating…' : 'Create Meeting'}
          </button>
        </div>
      </div>
    </div>
  )
}
