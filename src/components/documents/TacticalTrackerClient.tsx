'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Search, Download, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { updateTacticalItem, createTacticalItem } from '@/lib/data'

// 12 columns matching Vanessa's F&C Weekly Tactical Doc tracker
type ColDef = {
  key:        string
  label:      string
  width:      string
  type:       'text' | 'number' | 'bool' | 'readonly'
  editable?:  boolean
}

const COLUMNS: ColDef[] = [
  { key: 'agenda_number',     label: 'Agenda #',             width: '60px',  type: 'number', editable: true },
  { key: 'campus_name',       label: 'Campus/Item',          width: '180px', type: 'text',   editable: true },
  { key: 'subtopic',          label: 'Subtopic',             width: '140px', type: 'text',   editable: true },
  { key: 'presenter_name',    label: 'Presenter',            width: '120px', type: 'text',   editable: true },
  { key: 'description',       label: 'Description',          width: '220px', type: 'text',   editable: true },
  { key: 'discussion_notes',  label: 'Notes',                width: '240px', type: 'text',   editable: true },
  { key: 'next_steps',        label: 'Next Steps',           width: '200px', type: 'text',   editable: true },
  { key: 'fc_outcome',        label: 'F&C Committee Outcome', width: '140px', type: 'text',  editable: true },
  { key: 'layne_approval',    label: 'Layne Fisher (TX)',    width: '120px', type: 'text',   editable: true },
  { key: 'trevor_approval',   label: 'Trevor Brooks (IPS)',  width: '120px', type: 'text',   editable: true },
  { key: 'legal_review_reqd', label: 'Legal Review Reqd',    width: '100px', type: 'bool',   editable: true },
  { key: 'finance_committee', label: 'Finance Committee',    width: '140px', type: 'text',   editable: true },
]

type OrgTab = 'all' | 'idea_tx' | 'ips'
const IPS_STATES = ['FL', 'OH', 'IPS_FL']

// Group items by meeting, then by TX/IPS section
type Section = { label: 'TX' | 'IPS'; items: any[] }
type MeetingGroup = { meetingId: string; meetingDate: string; meetingTitle: string; sections: Section[] }

export function TacticalTrackerClient({
  items, meetings, orgId,
}: {
  items: any[]
  meetings: any[]
  orgId: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [orgTab, setOrgTab] = useState<OrgTab>('all')
  const [rows, setRows] = useState(items)
  const [adding, setAdding] = useState<string | null>(null)  // key: `${meetingId}:${section}`

  useEffect(() => { setRows(items) }, [items])

  async function addRow(meetingId: string, section: 'TX' | 'IPS') {
    const key = `${meetingId}:${section}`
    setAdding(key)
    try {
      // Determine next agenda number for this meeting+section
      const existing = rows.filter(r => {
        if (r.meeting_id !== meetingId) return false
        const isTx = r.state === 'TX' || r.state === 'TX_IPS'
        return section === 'TX' ? isTx : !isTx
      })
      const nextAgenda = Math.max(0, ...existing.map(r => r.agenda_number ?? 0)) + 1
      const defaultState = section === 'TX' ? 'TX' : 'FL'
      const newItem = await createTacticalItem({
        meeting_id: meetingId,
        org_id: orgId,
        state: defaultState,
        agenda_number: nextAgenda,
        campus_name: '',
      })
      // Attach meeting data locally so the row renders under the right group
      const meeting = meetings.find(m => m.id === meetingId)
      setRows(prev => [{ ...newItem, meetings: meeting }, ...prev])
    } catch (e) {
      console.error('Failed to add row', e)
      alert('Failed to add item')
    } finally {
      setAdding(null)
    }
  }

  const filtered = useMemo(() => {
    return rows.filter(i => {
      if (orgTab === 'idea_tx' && i.state !== 'TX' && i.state !== 'TX_IPS') return false
      if (orgTab === 'ips' && !IPS_STATES.includes(i.state)) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          i.campus_name?.toLowerCase().includes(q) ||
          i.subtopic?.toLowerCase().includes(q) ||
          i.presenter_name?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.discussion_notes?.toLowerCase().includes(q) ||
          i.next_steps?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [rows, orgTab, search])

  // Group by meeting → TX/IPS
  const groups: MeetingGroup[] = useMemo(() => {
    const byMeeting = new Map<string, MeetingGroup>()
    for (const item of filtered) {
      const mid = item.meeting_id
      if (!mid) continue
      if (!byMeeting.has(mid)) {
        byMeeting.set(mid, {
          meetingId: mid,
          meetingDate: item.meetings?.meeting_date ?? '',
          meetingTitle: item.meetings?.title ?? '',
          sections: [
            { label: 'TX', items: [] },
            { label: 'IPS', items: [] },
          ],
        })
      }
      const g = byMeeting.get(mid)!
      const isTx = item.state === 'TX' || item.state === 'TX_IPS'
      g.sections[isTx ? 0 : 1].items.push(item)
    }
    // Sort items within sections by agenda_number
    for (const g of byMeeting.values()) {
      for (const s of g.sections) {
        s.items.sort((a, b) => (a.agenda_number ?? 999) - (b.agenda_number ?? 999))
      }
    }
    // Sort groups by meeting_date descending
    return Array.from(byMeeting.values()).sort((a, b) => {
      return (b.meetingDate ?? '').localeCompare(a.meetingDate ?? '')
    })
  }, [filtered])

  const counts = useMemo(() => ({
    all: rows.length,
    idea_tx: rows.filter(i => i.state === 'TX' || i.state === 'TX_IPS').length,
    ips: rows.filter(i => IPS_STATES.includes(i.state)).length,
  }), [rows])

  async function saveCell(itemId: string, key: string, value: any) {
    setRows(prev => prev.map(r => r.id === itemId ? { ...r, [key]: value } : r))
    try {
      await updateTacticalItem(itemId, { [key]: value } as any)
    } catch (e) {
      console.error('Save failed:', e)
      router.refresh()
    }
  }

  function exportCsv() {
    const lines: string[] = []
    lines.push(['Meeting Date', 'Section', ...COLUMNS.map(c => c.label)].join(','))
    for (const g of groups) {
      for (const s of g.sections) {
        if (s.items.length === 0) continue
        for (const item of s.items) {
          const row = [
            g.meetingDate ? format(new Date(g.meetingDate), 'yyyy-MM-dd') : '',
            s.label,
            ...COLUMNS.map(c => {
              const v = item[c.key]
              if (v == null) return ''
              const s = String(v).replace(/"/g, '""')
              return /[",\n]/.test(s) ? `"${s}"` : s
            }),
          ]
          lines.push(row.join(','))
        }
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const tag = orgTab === 'idea_tx' ? 'idea-tx' : orgTab === 'ips' ? 'ips' : 'all'
    a.download = `tactical-tracker-${tag}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabTitle = orgTab === 'idea_tx' ? 'IDEA TX' : orgTab === 'ips' ? 'IPS (FL / OH)' : 'All'

  return (
    <div className="p-4 space-y-3 h-full flex flex-col min-h-0">
      {/* Org tabs */}
      <div className="flex items-center gap-1 border-b border-default">
        {([
          { v: 'idea_tx' as OrgTab, label: 'IDEA TX',       count: counts.idea_tx },
          { v: 'ips' as OrgTab,     label: 'IPS (FL / OH)', count: counts.ips },
          { v: 'all' as OrgTab,     label: 'All Orgs',      count: counts.all },
        ]).map(t => (
          <button
            key={t.v}
            onClick={() => setOrgTab(t.v)}
            className={clsx(
              'relative px-4 py-2 text-[12px] font-semibold transition-colors -mb-px border-b-2',
              orgTab === t.v ? 'text-blue-400 border-blue-500' : 'text-muted border-transparent hover:text-default'
            )}
          >
            {t.label}
            <span className={clsx(
              'ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded-full',
              orgTab === t.v ? 'bg-blue-500/15 text-blue-400' : 'bg-surface-2 text-dim'
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-syne font-bold text-[17px] text-default">
            {tabTitle} — Weekly Tactical Tracker
          </h2>
          <div className="text-[11px] text-muted mt-0.5">
            {filtered.length} items across {groups.length} meetings · Click any cell to edit
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AddToMeetingMenu meetings={meetings} onAdd={addRow} />
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="input-base pl-8 text-xs w-[240px]"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border border-default rounded-md text-muted hover:text-default transition-colors"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="card flex-1 min-h-0 overflow-auto">
        <table className="border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {COLUMNS.map(c => (
                <th
                  key={c.key}
                  className="sticky top-0 z-20 bg-surface-2 border-b border-r border-default px-2 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-dim whitespace-nowrap"
                  style={{ width: c.width, minWidth: c.width }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <MeetingBlock
                key={g.meetingId}
                group={g}
                orgTab={orgTab}
                onSaveCell={saveCell}
                onAddRow={addRow}
                addingKey={adding}
              />
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-12 text-center text-muted">
                  No tactical items match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Meeting block (header row + TX/IPS sections) ────────────

function MeetingBlock({
  group, orgTab, onSaveCell, onAddRow, addingKey,
}: {
  group: MeetingGroup
  orgTab: OrgTab
  onSaveCell: (id: string, key: string, v: any) => void
  onAddRow: (meetingId: string, section: 'TX' | 'IPS') => void
  addingKey: string | null
}) {
  const meetingLabel = group.meetingDate
    ? format(new Date(group.meetingDate), 'EEEE, MMMM d, yyyy')
    : 'Unknown date'

  const sectionsToShow = group.sections.filter(s => {
    if (orgTab === 'idea_tx' && s.label !== 'TX') return false
    if (orgTab === 'ips' && s.label !== 'IPS') return false
    return true
  })

  if (sectionsToShow.length === 0) return null

  return (
    <>
      {/* Meeting header row */}
      <tr>
        <td
          colSpan={COLUMNS.length}
          className="sticky left-0 bg-blue-500/10 border-y border-blue-500/30 px-3 py-2 text-[11px] font-bold text-blue-300"
        >
          {group.meetingTitle || `Facilities and Construction Doc Rev- ${meetingLabel}`}
        </td>
      </tr>
      {sectionsToShow.map(section => (
        <SectionBlock
          key={section.label}
          section={section}
          meetingId={group.meetingId}
          onSaveCell={onSaveCell}
          onAddRow={onAddRow}
          isAdding={addingKey === `${group.meetingId}:${section.label}`}
        />
      ))}
    </>
  )
}

function SectionBlock({
  section, meetingId, onSaveCell, onAddRow, isAdding,
}: {
  section: Section
  meetingId: string
  onSaveCell: (id: string, key: string, v: any) => void
  onAddRow: (meetingId: string, section: 'TX' | 'IPS') => void
  isAdding: boolean
}) {
  return (
    <>
      {/* Section label */}
      <tr>
        <td
          colSpan={COLUMNS.length}
          className={clsx(
            'border-b border-default px-3 py-1 text-[10px] font-bold tracking-widest uppercase',
            section.label === 'TX' ? 'bg-amber-500/5 text-amber-400' : 'bg-purple-500/5 text-purple-400'
          )}
        >
          {section.label}
        </td>
      </tr>
      {section.items.map((item, idx) => (
        <tr key={item.id} className={clsx(idx % 2 === 0 ? 'bg-app' : 'bg-surface/40', 'hover:bg-surface-2/60')}>
          {COLUMNS.map(c => (
            <td
              key={c.key}
              className="border-b border-r border-default px-0 py-0 align-top"
              style={{ width: c.width, minWidth: c.width, maxWidth: c.width }}
            >
              <Cell item={item} col={c} onSave={v => onSaveCell(item.id, c.key, v)} />
            </td>
          ))}
        </tr>
      ))}
      {/* Add row button */}
      <tr>
        <td colSpan={COLUMNS.length} className="border-b border-default px-2 py-1 bg-app">
          <button
            onClick={() => onAddRow(meetingId, section.label)}
            disabled={isAdding}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-dim hover:text-blue-400 transition-colors disabled:opacity-50"
          >
            <Plus size={11} /> {isAdding ? 'Adding…' : `Add ${section.label} item`}
          </button>
        </td>
      </tr>
    </>
  )
}

// ── Add-to-meeting dropdown ─────────────────────────────────

function AddToMeetingMenu({
  meetings, onAdd,
}: {
  meetings: any[]
  onAdd: (meetingId: string, section: 'TX' | 'IPS') => void
}) {
  const [open, setOpen] = useState(false)
  const [meetingId, setMeetingId] = useState(meetings[0]?.id ?? '')
  const [section, setSection] = useState<'TX' | 'IPS'>('TX')

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-colors"
      >
        <Plus size={12} /> Add Item
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-[320px] card p-3 space-y-2 shadow-lg">
            <div className="text-[10px] font-bold text-dim uppercase tracking-wider">Add to meeting</div>
            <select
              value={meetingId}
              onChange={e => setMeetingId(e.target.value)}
              className="input-base text-xs w-full"
            >
              {meetings.map(m => (
                <option key={m.id} value={m.id}>
                  {m.meeting_date ? format(new Date(m.meeting_date), 'MMM d, yyyy') : ''} — {m.title ?? m.meeting_type}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              {(['TX','IPS'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  className={clsx(
                    'flex-1 px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-colors',
                    section === s
                      ? s === 'TX'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                      : 'border-default text-muted hover:text-default'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              disabled={!meetingId}
              onClick={() => {
                onAdd(meetingId, section)
                setOpen(false)
              }}
              className="w-full px-3 py-1.5 text-[11px] font-bold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              Add {section} item
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Cell ────────────────────────────────────────────────────

function Cell({ item, col, onSave }: { item: any; col: ColDef; onSave: (v: any) => void }) {
  const [editing, setEditing] = useState(false)
  const raw = item[col.key]

  const displayValue = (() => {
    if (raw == null || raw === '') return ''
    if (col.type === 'bool') return raw === true ? '✓' : raw === false ? '—' : ''
    return String(raw)
  })()

  if (editing && col.editable) {
    return (
      <EditCell
        col={col}
        initial={raw}
        onCommit={v => { setEditing(false); if (v !== raw) onSave(v) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div
      onClick={() => col.editable && setEditing(true)}
      className={clsx(
        'px-2 py-1.5 truncate min-h-[26px]',
        col.editable && 'cursor-pointer hover:bg-blue-500/5 hover:ring-1 hover:ring-blue-500/30',
        col.type === 'bool' && 'text-center',
        col.type === 'number' && 'font-mono text-center',
      )}
      title={displayValue || (col.editable ? 'Click to edit' : '')}
    >
      {displayValue || <span className="text-dim">—</span>}
    </div>
  )
}

function EditCell({ col, initial, onCommit, onCancel }: {
  col: ColDef; initial: any; onCommit: (v: any) => void; onCancel: () => void
}) {
  const [val, setVal] = useState(() => {
    if (col.type === 'bool') return initial === true
    if (initial == null) return ''
    return String(initial)
  })
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.focus()
      if ('select' in ref.current) (ref.current as HTMLInputElement).select?.()
    }
  }, [])

  function commit() {
    if (col.type === 'bool') { onCommit(val); return }
    const s = String(val).trim()
    if (s === '') { onCommit(null); return }
    if (col.type === 'number') { onCommit(Number(s)); return }
    onCommit(s)
  }

  if (col.type === 'bool') {
    return (
      <select
        ref={ref as any}
        value={val ? 'true' : 'false'}
        onChange={e => setVal(e.target.value === 'true')}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
        className="w-full px-2 py-1.5 text-[11px] bg-surface border border-blue-500 outline-none"
      >
        <option value="true">✓ Yes</option>
        <option value="false">— No</option>
      </select>
    )
  }

  return (
    <input
      ref={ref as any}
      type={col.type === 'number' ? 'number' : 'text'}
      value={val as string}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
      className="w-full px-2 py-1.5 text-[11px] bg-surface border border-blue-500 outline-none"
    />
  )
}
