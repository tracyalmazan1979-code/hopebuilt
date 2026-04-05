'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PipelineBadge, FileBadge, StateBadge, Amount, PageHeader, EmptyState } from '@/components/ui'
import { format } from 'date-fns'
import { Search, Filter, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import type { PipelineStatus, StateRegion } from '@/types'

const PIPELINE_FILTERS: { label: string; value: PipelineStatus | 'all' | 'waiting' }[] = [
  { label: 'All Active',    value: 'all' },
  { label: 'Needs FC',      value: 'pending_fc_review' },
  { label: 'Waiting',       value: 'waiting' },
  { label: 'Pending BOD',   value: 'pending_bod' },
  { label: 'Pending Exec',  value: 'pending_execution' },
  { label: 'Executed',      value: 'fully_executed' },
]

export function AllDocumentsClient({
  documents,
  initialFilters,
}: {
  documents:      any[]
  initialFilters: { status?: string; state?: string; q?: string }
}) {
  const [search,    setSearch]    = useState(initialFilters.q ?? '')
  const [statusFilter, setStatus] = useState(initialFilters.status ?? 'all')
  const [stateFilter,  setState]  = useState(initialFilters.state ?? 'all')
  const [pendingDoc,   setPending] = useState(false)
  const [bodRequired,  setBOD]    = useState(false)
  const [legalRequired, setLegal]  = useState(false)

  const WAITING = ['pending_coo','pending_treasury','pending_legal','pending_finance_committee']

  const filtered = useMemo(() => {
    return documents.filter(d => {
      if (stateFilter !== 'all' && d.state !== stateFilter) return false
      if (pendingDoc && d.file_status !== 'pending_doc') return false
      if (bodRequired && !d.bod_items?.length) return false
      if (legalRequired) {
        const hasLegal = d.approvals?.some((a: any) => a.stage === 'legal' && a.is_required)
        if (!hasLegal) return false
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'waiting') {
          if (!WAITING.includes(d.pipeline_status)) return false
        } else {
          if (d.pipeline_status !== statusFilter) return false
        }
      }
      if (search) {
        const q = search.toLowerCase()
        return (
          d.campus_name?.toLowerCase().includes(q) ||
          d.document_type_name?.toLowerCase().includes(q) ||
          d.presenter_name?.toLowerCase().includes(q) ||
          d.legal_ticket_number?.toLowerCase().includes(q) ||
          d.vendor_name?.toLowerCase().includes(q) ||
          d.funding_source?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [documents, search, statusFilter, stateFilter, pendingDoc, bodRequired, legalRequired])

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="All Documents"
        subtitle={`${filtered.length} of ${documents.length} active documents`}
        actions={
          <Link
            href="/documents/new"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-colors"
          >
            <Plus size={14} /> Submit Document
          </Link>
        }
      />

      {/* Filters */}
      <div className="card p-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="input-base pl-9 text-sm"
            placeholder="Search campus, doc type, presenter, ticket number, vendor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter chips row */}
        <div className="flex flex-wrap gap-2">
          {/* Pipeline status */}
          <div className="flex rounded-md overflow-hidden border border-default">
            {PIPELINE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={clsx(
                  'px-3 py-1.5 text-[11px] font-semibold border-r border-default last:border-r-0 transition-colors',
                  statusFilter === f.value
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-muted hover:text-default'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* State */}
          {['all','TX','FL','OH'].map(s => (
            <button
              key={s}
              onClick={() => setState(s)}
              className={clsx(
                'px-3 py-1.5 text-[11px] font-semibold rounded-md border transition-colors',
                stateFilter === s
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  : 'border-default text-muted hover:text-default'
              )}
            >
              {s === 'all' ? 'All States' : s}
            </button>
          ))}

          {/* Toggles */}
          {[
            { label: '⏳ Pending Doc', active: pendingDoc,   toggle: () => setPending(p => !p) },
            { label: '🏛 BOD Required', active: bodRequired,  toggle: () => setBOD(b => !b) },
            { label: '⚖ Legal Required', active: legalRequired, toggle: () => setLegal(l => !l) },
          ].map(({ label, active, toggle }) => (
            <button
              key={label}
              onClick={toggle}
              className={clsx(
                'px-3 py-1.5 text-[11px] font-semibold rounded-md border transition-colors',
                active
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'border-default text-muted hover:text-default'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No documents match your filters"
          description="Try adjusting the filters above or submitting a new document."
          action={
            <Link href="/documents/new" className="px-4 py-2 text-sm font-bold bg-amber-500 text-black rounded-md">
              Submit Document
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-2">
                  {['Date','ST','Campus / Item','Type','Amount','Submitter','FC Outcome','Pipeline Status','File'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-dim whitespace-nowrap border-b border-default">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => {
                  const isOverdue = doc.approvals?.some((a: any) => a.is_overdue && a.status === 'pending')
                  return (
                    <tr
                      key={doc.id}
                      className={clsx(
                        'border-b border-default hover:bg-surface-2 cursor-pointer transition-colors',
                        i % 2 === 0 ? 'bg-app' : 'bg-surface/50',
                        isOverdue && 'bg-red-500/3'
                      )}
                      onClick={() => window.location.href = `/documents/${doc.id}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-[11px] text-muted whitespace-nowrap">
                        {doc.created_at ? format(new Date(doc.created_at), 'MM/dd/yy') : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <StateBadge state={doc.state} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-[12px] text-default max-w-[200px] truncate">{doc.campus_name}</div>
                        {doc.vendor_name && <div className="text-[10px] text-dim truncate">{doc.vendor_name}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted max-w-[160px]">
                        <div className="truncate">{doc.document_type_name}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Amount value={doc.amount} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={clsx(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded',
                          doc.submitter_type === 'pmsi'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-blue-500/15 text-blue-400'
                        )}>
                          {doc.submitter_type === 'pmsi' ? 'PMSI' : 'IDEA'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px]">
                        {doc.fc_outcome ? (
                          <span className={clsx('font-semibold', {
                            'text-green-400':  doc.fc_outcome.includes('APPROVED'),
                            'text-orange-400': doc.fc_outcome === 'ON HOLD',
                            'text-red-400':    doc.fc_outcome === 'DENIED',
                          })}>
                            {doc.fc_outcome}
                          </span>
                        ) : <span className="text-dim">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <PipelineBadge status={doc.pipeline_status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <FileBadge status={doc.file_status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
