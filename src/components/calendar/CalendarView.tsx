'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────

interface Meeting {
  id: string
  meeting_date: string
  meeting_type: string
  state: string | null
  title: string | null
}

interface BODItem {
  id: string
  bod_meeting_id: string | null
  documents: { campus_name: string | null; document_type_name: string | null; amount: number | null } | null
}

interface OverdueApproval {
  id: string
  stage: string
  days_at_stage: number
  documents: { campus_name: string | null; document_type_name: string | null } | null
}

// ── Helpers ──────────────────────────────────────────────────

const MEETING_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  fac_doc_rev:      { bg: 'bg-blue-500/20',   text: 'text-blue-400',   label: 'FAC Doc Review' },
  tactical:         { bg: 'bg-purple-500/20',  text: 'text-purple-400', label: 'Tactical' },
  bod:              { bg: 'bg-red-500/20',     text: 'text-red-400',    label: 'BOD Meeting' },
  predoc_pmsi:      { bg: 'bg-amber-500/20',   text: 'text-amber-400',  label: 'PMSI PreDoc' },
  predoc_idea:      { bg: 'bg-green-500/20',   text: 'text-green-400',  label: 'IDEA PreDoc' },
  layne_solo_review:{ bg: 'bg-cyan-500/20',    text: 'text-cyan-400',   label: 'Layne Review' },
}

function getMeetingStyle(type: string) {
  return MEETING_TYPE_COLORS[type] ?? { bg: 'bg-gray-500/20', text: 'text-gray-400', label: type }
}

// ── Calendar Component ───────────────────────────────────────

export function CalendarView({
  meetings: initialMeetings,
  bodItems,
  overdueApprovals,
}: {
  meetings: Meeting[]
  bodItems: BODItem[]
  overdueApprovals: OverdueApproval[]
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [meetings, setMeetings] = useState(initialMeetings)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  // Group meetings by date
  function getMeetingsForDate(date: Date) {
    return meetings.filter(m => isSameDay(parseISO(m.meeting_date), date))
  }

  // Get overdue count for display
  const overdueCount = overdueApprovals.length
  const pendingBodCount = bodItems.filter(b => !b.bod_meeting_id).length

  // Update meeting date
  async function handleUpdateDate() {
    if (!editingMeeting || !newDate) return
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase
        .from('meetings')
        .update({ meeting_date: newDate })
        .eq('id', editingMeeting.id)

      setMeetings(prev =>
        prev.map(m => m.id === editingMeeting.id ? { ...m, meeting_date: newDate } : m)
      )
      setEditingMeeting(null)
      setNewDate('')
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-syne font-black text-xl text-default">Calendar</h1>
          <p className="text-xs text-muted mt-0.5">Meetings, deadlines, and BOD dates</p>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <div className="text-[10px] px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 font-semibold">
              {overdueCount} overdue approval{overdueCount > 1 ? 's' : ''}
            </div>
          )}
          {pendingBodCount > 0 && (
            <div className="text-[10px] px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400 font-semibold">
              {pendingBodCount} BOD item{pendingBodCount > 1 ? 's' : ''} unscheduled
            </div>
          )}
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 rounded-md hover:bg-surface-2 text-muted hover:text-default transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-syne font-bold text-lg text-default">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-md hover:bg-surface-2 text-muted hover:text-default transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(MEETING_TYPE_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={clsx('w-2.5 h-2.5 rounded-full', val.bg)} />
            <span className="text-[10px] text-muted">{val.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-default">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-dim">
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7">
          {days.map((date, idx) => {
            const dayMeetings = getMeetingsForDate(date)
            const inMonth = isSameMonth(date, currentMonth)
            const today = isToday(date)
            const selected = selectedDate && isSameDay(date, selectedDate)

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={clsx(
                  'min-h-[100px] p-1.5 border-b border-r border-default cursor-pointer transition-colors',
                  !inMonth && 'opacity-30',
                  selected && 'bg-amber-500/5',
                  !selected && 'hover:bg-surface-2',
                )}
              >
                <div className={clsx(
                  'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  today && 'bg-amber-500 text-black',
                  !today && 'text-muted',
                )}>
                  {format(date, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayMeetings.slice(0, 3).map(m => {
                    const style = getMeetingStyle(m.meeting_type)
                    return (
                      <div
                        key={m.id}
                        className={clsx('text-[9px] font-semibold px-1.5 py-0.5 rounded truncate', style.bg, style.text)}
                        title={m.title ?? style.label}
                      >
                        {style.label}
                        {m.state ? ` · ${m.state}` : ''}
                      </div>
                    )
                  })}
                  {dayMeetings.length > 3 && (
                    <div className="text-[9px] text-dim px-1">+{dayMeetings.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected date detail panel */}
      {selectedDate && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-syne font-bold text-sm text-default">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-dim hover:text-default text-xs"
            >
              Close
            </button>
          </div>

          {getMeetingsForDate(selectedDate).length === 0 ? (
            <p className="text-xs text-dim">No meetings scheduled for this date.</p>
          ) : (
            <div className="space-y-2">
              {getMeetingsForDate(selectedDate).map(m => {
                const style = getMeetingStyle(m.meeting_type)
                return (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-md bg-surface-2 border border-default">
                    <div className="flex items-center gap-3">
                      <div className={clsx('text-[10px] font-bold px-2.5 py-1 rounded-full', style.bg, style.text)}>
                        {style.label}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-default">
                          {m.title ?? style.label}
                        </div>
                        {m.state && <div className="text-[10px] text-dim">{m.state}</div>}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingMeeting(m)
                        setNewDate(m.meeting_date)
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      Change Date
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit meeting date modal */}
      {editingMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h3 className="font-syne font-bold text-sm text-default">
              Reschedule Meeting
            </h3>
            <div className="text-xs text-muted">
              {getMeetingStyle(editingMeeting.meeting_type).label}
              {editingMeeting.title ? ` — ${editingMeeting.title}` : ''}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1.5">
                New Date
              </label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="input-base w-full"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setEditingMeeting(null); setNewDate('') }}
                className="px-4 py-2 text-xs text-muted hover:text-default border border-default rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDate}
                disabled={saving || !newDate}
                className="px-4 py-2 text-xs bg-amber-500 text-black font-bold rounded-md hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming meetings list */}
      <div className="card p-5 space-y-3">
        <h3 className="font-syne font-bold text-xs uppercase tracking-wider text-muted">
          Upcoming Meetings
        </h3>
        <div className="space-y-1.5">
          {meetings
            .filter(m => parseISO(m.meeting_date) >= new Date(new Date().setHours(0,0,0,0)))
            .slice(0, 15)
            .map(m => {
              const style = getMeetingStyle(m.meeting_type)
              return (
                <div key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-surface-2 transition-colors">
                  <div className="text-[10px] font-mono text-muted w-24 flex-shrink-0">
                    {format(parseISO(m.meeting_date), 'EEE MMM d')}
                  </div>
                  <div className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', style.bg, style.text)}>
                    {style.label}
                  </div>
                  <div className="text-xs text-default truncate">
                    {m.title ?? ''}
                  </div>
                  {m.state && (
                    <div className="text-[10px] text-dim ml-auto flex-shrink-0">{m.state}</div>
                  )}
                </div>
              )
            })}
          {meetings.filter(m => parseISO(m.meeting_date) >= new Date(new Date().setHours(0,0,0,0))).length === 0 && (
            <p className="text-xs text-dim">No upcoming meetings scheduled.</p>
          )}
        </div>
      </div>
    </div>
  )
}
