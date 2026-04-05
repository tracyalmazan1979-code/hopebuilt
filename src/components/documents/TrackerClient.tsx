'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Search, Download, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import { updateDocument } from '@/lib/data'

// 29 columns matching Vanessa's F&C Weekly Doc Review Tracker
type ColDef = {
  key:    string
  label:  string
  width:  string
  type:   'date' | 'text' | 'number' | 'bool' | 'derived' | 'readonly'
  editable?: boolean
}

const COLUMNS: ColDef[] = [
  { key: 'fc_date',                 label: 'FC Date',                 width: '90px',  type: 'date',     editable: true },
  { key: 'state',                   label: 'State',                   width: '60px',  type: 'text' },
  { key: 'doc_number',              label: 'Doc #',                   width: '60px',  type: 'number' },
  { key: 'campus_name',             label: 'Campus',                  width: '160px', type: 'text' },
  { key: 'document_type_name',      label: 'Document/Project Type',   width: '160px', type: 'text' },
  { key: 'presenter_name',          label: 'Presenter',               width: '120px', type: 'text' },
  { key: 'amount',                  label: 'Amount $',                width: '110px', type: 'number' },
  { key: 'funding_request',         label: 'Funding Request',         width: '140px', type: 'text',     editable: true },
  { key: 'funding_source',          label: 'Funding Source',          width: '140px', type: 'text',     editable: true },
  { key: 'description',             label: 'Description',             width: '220px', type: 'text',     editable: true },
  { key: 'notes',                   label: 'Notes',                   width: '180px', type: 'text',     editable: true },
  { key: 'next_steps',              label: 'Next Steps',              width: '160px', type: 'text',     editable: true },
  { key: 'fc_outcome',              label: 'FC Committee Outcome',    width: '140px', type: 'derived' },
  { key: 'coo_approval',            label: 'COO Approval',            width: '100px', type: 'derived' },
  { key: 'treasury_approval',       label: 'Treasury/Finance Approval', width: '130px', type: 'derived' },
  { key: 'legal_review_reqd',       label: 'Legal Review Reqd',       width: '120px', type: 'derived' },
  { key: 'budget_amendment_reqd',   label: 'Budget Amendment Reqd',   width: '130px', type: 'bool',     editable: true },
  { key: 'fc_meeting_date',         label: 'Finance Committee Mtg Date', width: '130px', type: 'derived' },
  { key: 'board_approval_reqd',     label: 'Board Approval Reqd',     width: '120px', type: 'derived' },
  { key: 'bod_item_type',           label: 'BOD Item Type',           width: '120px', type: 'text',     editable: true },
  { key: 'bod_meeting_date',        label: 'BOD Meeting Date',        width: '110px', type: 'derived' },
  { key: 'board_approved',          label: 'Board Approved',          width: '110px', type: 'derived' },
  { key: 'date_sent_via_adobe',     label: 'Date Sent via Adobe',     width: '110px', type: 'date',     editable: true },
  { key: 'date_approved_sent_out',  label: 'Date Approved/Sent Out',  width: '110px', type: 'date',     editable: true },
  { key: 'wet_signature_notary',    label: 'WET Signature/Notary',    width: '140px', type: 'text',     editable: true },
  { key: 'gl_account',              label: 'GL Account',              width: '120px', type: 'text',     editable: true },
  { key: 'gl_account_funded',       label: 'GL Account Funded',       width: '100px', type: 'bool',     editable: true },
  { key: 'notified_rm',             label: 'Notified RM',             width: '90px',  type: 'bool',     editable: true },
  { key: 'additional_notes',        label: 'Notes (2)',               width: '180px', type: 'text',     editable: true },
]

export function TrackerClient({ documents }: { documents: any[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [rows, setRows] = useState(documents)

  // Keep rows in sync when server refreshes data
  useEffect(() => { setRows(documents) }, [documents])

  const filtered = useMemo(() => {
    return rows.filter(d => {
      if (stateFilter !== 'all' && d.state !== stateFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          d.campus_name?.toLowerCase().includes(q) ||
          d.document_type_name?.toLowerCase().includes(q) ||
          d.presenter_name?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.notes?.toLowerCase().includes(q) ||
          d.funding_source?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [rows, search, stateFilter])

  async function saveCell(docId: string, key: string, value: any) {
    // Optimistic update
    setRows(prev => prev.map(r => r.id === docId ? { ...r, [key]: value } : r))
    try {
      await updateDocument(docId, { [key]: value } as any)
    } catch (e) {
      console.error('Save failed:', e)
      // Revert on error
      router.refresh()
    }
  }

  function exportCsv() {
    const headers = COLUMNS.map(c => c.label).join(',')
    const rowsCsv = filtered.map(d =>
      COLUMNS.map(c => {
        const v = getCellValue(d, c)
        if (v == null) return ''
        const s = String(v).replace(/"/g, '""')
        return /[",\n]/.test(s) ? `"${s}"` : s
      }).join(',')
    ).join('\n')
    const blob = new Blob([headers + '\n' + rowsCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tracker-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 space-y-3 h-full flex flex-col min-h-0">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-syne font-bold text-[17px] text-default">Weekly Doc Review Tracker</h2>
          <div className="text-[11px] text-muted mt-0.5">
            {filtered.length} of {rows.length} documents · Click any editable cell to update
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="input-base pl-8 text-xs w-[240px]"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex rounded-md overflow-hidden border border-default">
            {['all','TX','FL','OH'].map(s => (
              <button
                key={s}
                onClick={() => setStateFilter(s)}
                className={clsx(
                  'px-2.5 py-1.5 text-[10px] font-semibold border-r border-default last:border-r-0 transition-colors',
                  stateFilter === s ? 'bg-blue-500/15 text-blue-400' : 'text-muted hover:text-default'
                )}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
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
              {/* Sticky action column */}
              <th className="sticky top-0 left-0 z-30 bg-surface-2 border-b border-r border-default px-2 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-dim"
                  style={{ width: '44px', minWidth: '44px' }}>
                #
              </th>
              {COLUMNS.map((c, i) => (
                <th
                  key={c.key}
                  className={clsx(
                    'sticky top-0 z-20 bg-surface-2 border-b border-r border-default px-2 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-dim whitespace-nowrap',
                    i === 0 && 'sticky left-[44px] z-30'
                  )}
                  style={{ width: c.width, minWidth: c.width }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((doc, rowIdx) => (
              <tr key={doc.id} className={clsx(rowIdx % 2 === 0 ? 'bg-app' : 'bg-surface/40', 'hover:bg-surface-2/60')}>
                <td className="sticky left-0 z-10 bg-inherit border-b border-r border-default px-2 py-1 text-center"
                    style={{ width: '44px', minWidth: '44px' }}>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="inline-flex items-center justify-center w-5 h-5 rounded text-muted hover:text-blue-400 hover:bg-blue-500/10"
                    title="Open detail"
                  >
                    <ExternalLink size={11} />
                  </Link>
                </td>
                {COLUMNS.map((c, colIdx) => (
                  <td
                    key={c.key}
                    className={clsx(
                      'border-b border-r border-default px-0 py-0 align-top',
                      colIdx === 0 && 'sticky left-[44px] z-10 bg-inherit'
                    )}
                    style={{ width: c.width, minWidth: c.width, maxWidth: c.width }}
                  >
                    <Cell doc={doc} col={c} onSave={v => saveCell(doc.id, c.key, v)} />
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-6 py-12 text-center text-muted">
                  No documents match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Cell rendering ───────────────────────────────────────────

function getCellValue(doc: any, col: ColDef): any {
  if (col.type !== 'derived') return doc[col.key]
  switch (col.key) {
    case 'fc_outcome':
      return doc.fc_outcome ?? deriveFcOutcome(doc)
    case 'coo_approval':
      return approvalSummary(doc, 'coo')
    case 'treasury_approval':
      return approvalSummary(doc, 'treasury_finance')
    case 'legal_review_reqd': {
      const legal = doc.approvals?.find((a: any) => a.stage === 'legal')
      if (!legal) return ''
      return legal.ticket_number
        ? `Yes (${legal.ticket_number})`
        : legal.status === 'not_required' ? 'No' : 'Yes'
    }
    case 'fc_meeting_date':
      return doc.meetings?.meeting_date ?? doc.fc_date
    case 'board_approval_reqd': {
      const bod = Array.isArray(doc.bod_items) ? doc.bod_items[0] : doc.bod_items
      return bod ? 'Yes' : ''
    }
    case 'bod_meeting_date': {
      const bod = Array.isArray(doc.bod_items) ? doc.bod_items[0] : doc.bod_items
      return bod?.meetings?.meeting_date ?? null
    }
    case 'board_approved': {
      const bod = Array.isArray(doc.bod_items) ? doc.bod_items[0] : doc.bod_items
      if (!bod) return ''
      if (bod.board_approved === true) return 'Approved'
      if (bod.board_approved === false) return 'Denied'
      return 'Pending'
    }
    default:
      return ''
  }
}

function deriveFcOutcome(doc: any): string {
  const fc = doc.approvals?.find((a: any) => a.stage === 'fc_committee')
  if (!fc) return ''
  const map: Record<string, string> = {
    approved: 'APPROVED',
    approved_pending_conditions: 'APPROVED W/ CONDITIONS',
    approved_by_delegation: 'APPROVED BY DELEGATION',
    denied: 'DENIED',
    on_hold: 'ON HOLD',
    pending: '',
    not_required: '',
  }
  return map[fc.status] ?? ''
}

function approvalSummary(doc: any, stage: string): string {
  const a = doc.approvals?.find((x: any) => x.stage === stage)
  if (!a) return ''
  if (a.status === 'not_required') return 'N/A'
  if (a.status === 'pending') return 'Pending'
  if (a.status === 'denied') return 'Denied'
  if (a.status === 'on_hold') return 'On Hold'
  return a.approver_name ? `✓ ${a.approver_name}` : '✓'
}

function Cell({ doc, col, onSave }: { doc: any; col: ColDef; onSave: (v: any) => void }) {
  const [editing, setEditing] = useState(false)
  const raw = getCellValue(doc, col)

  const displayValue = (() => {
    if (raw == null || raw === '') return ''
    if (col.type === 'date')   return safeDate(raw)
    if (col.type === 'number' && col.key === 'amount')
      return `$${Number(raw).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    if (col.type === 'bool')   return raw === true ? '✓' : raw === false ? '—' : ''
    return String(raw)
  })()

  if (!col.editable) {
    return (
      <div
        className={clsx(
          'px-2 py-1.5 truncate',
          col.type === 'derived' && 'text-muted italic',
          col.key === 'amount' && 'font-mono text-right text-default font-semibold',
          (col.key === 'state' || col.key === 'doc_number') && 'font-mono text-center',
        )}
        title={displayValue}
      >
        {displayValue || <span className="text-dim">—</span>}
      </div>
    )
  }

  if (editing) {
    return <EditCell col={col} initial={raw} onCommit={v => { setEditing(false); if (v !== raw) onSave(v) }} onCancel={() => setEditing(false)} />
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={clsx(
        'px-2 py-1.5 truncate cursor-pointer hover:bg-blue-500/5 hover:ring-1 hover:ring-blue-500/30 min-h-[26px]',
        col.type === 'bool' && 'text-center',
      )}
      title={displayValue || 'Click to edit'}
    >
      {displayValue || <span className="text-dim">—</span>}
    </div>
  )
}

function EditCell({ col, initial, onCommit, onCancel }: { col: ColDef; initial: any; onCommit: (v: any) => void; onCancel: () => void }) {
  const [val, setVal] = useState(() => {
    if (col.type === 'bool') return initial === true
    if (initial == null) return ''
    return String(initial)
  })
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.focus()
      if ('select' in ref.current) ref.current.select()
    }
  }, [])

  function commit() {
    if (col.type === 'bool') {
      onCommit(val)
      return
    }
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

  if (col.type === 'date') {
    const dateVal = (() => {
      if (!val) return ''
      try {
        const d = new Date(val)
        if (isNaN(d.getTime())) return ''
        return d.toISOString().slice(0, 10)
      } catch { return '' }
    })()
    return (
      <input
        ref={ref as any}
        type="date"
        value={dateVal}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
        className="w-full px-2 py-1.5 text-[11px] bg-surface border border-blue-500 outline-none"
      />
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

function safeDate(v: any): string {
  try {
    const d = new Date(v)
    if (isNaN(d.getTime())) return String(v)
    return format(d, 'MM/dd/yy')
  } catch { return String(v) }
}
