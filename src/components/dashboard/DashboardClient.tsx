'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getActivePipeline } from '@/lib/data'
import type { User, Organization, DashboardMetrics, ActivePipelineItem, SwimlaneLane } from '@/types'
import { PIPELINE_STATUS_LABELS } from '@/types'
import { formatDistanceToNow, format } from 'date-fns'
import { Plus, AlertTriangle, Clock, CheckCircle2, Building2, ChevronRight, FileWarning } from 'lucide-react'
import Link from 'next/link'
import { clsx } from 'clsx'

// ── Metric Card ───────────────────────────────────────────────

function MetricCard({
  icon, value, label, sub, accent, href,
}: {
  icon:   React.ReactNode
  value:  string | number
  label:  string
  sub?:   string
  accent: 'red' | 'amber' | 'blue' | 'green' | 'purple'
  href?:  string
}) {
  const accentMap = {
    red:    'before:bg-red-500',
    amber:  'before:bg-amber-500',
    blue:   'before:bg-blue-600',
    green:  'before:bg-green-500',
    purple: 'before:bg-purple-500',
  }

  const content = (
    <div className={clsx(
      'card p-4 relative overflow-hidden cursor-pointer',
      'before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px]',
      'hover:-translate-y-px transition-transform',
      accentMap[accent]
    )}>
      <div className="text-lg mb-1">{icon}</div>
      <div className="font-syne font-black text-2xl text-default leading-none">{value}</div>
      <div className="text-xs font-medium text-muted mt-1">{label}</div>
      {sub && <div className="text-[10px] text-dim mt-1 font-mono">{sub}</div>}
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}

// ── Swimlane Card ─────────────────────────────────────────────

function DocCard({ doc }: { doc: ActivePipelineItem }) {
  const isOverdue      = doc.is_overdue
  const isPendingDoc   = doc.file_status === 'pending_doc'
  const daysInStage    = doc.days_in_current_stage ?? 0

  const urgency = isOverdue || daysInStage > 7
    ? 'overdue'
    : daysInStage > 4
    ? 'warning'
    : 'normal'

  const borderMap = {
    overdue: 'border-l-red-500',
    warning: 'border-l-amber-500',
    normal:  'border-l-blue-500',
  }

  const stateColors: Record<string, string> = {
    TX:     'state-tx',
    FL:     'state-fl',
    OH:     'state-oh',
    IPS_FL: 'state-fl',
    TX_IPS: 'state-tx',
  }
  const stateClass = stateColors[doc.state] ?? 'state-tx'

  const amount = doc.amount != null
    ? doc.amount < 0
      ? `(${Math.abs(doc.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})`
      : doc.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : null

  return (
    <Link href={`/documents/${doc.id}`}>
      <div className={clsx(
        'bg-surface-2 border border-default border-l-4 rounded-md p-3 cursor-pointer',
        'hover:bg-surface-3 hover:translate-x-0.5 transition-all',
        borderMap[urgency]
      )}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className="text-[12px] font-semibold text-default leading-snug line-clamp-1">
            {doc.campus_name}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {doc.submitter_type === 'pmsi' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">PMSI</span>
            )}
            <span className={stateClass}>{doc.state}</span>
          </div>
        </div>

        {/* Doc type */}
        <div className="text-[11px] text-muted mb-2 line-clamp-1">
          {doc.document_type_name}
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          {amount && (
            <span className="font-mono text-[11px] font-semibold text-green-700">{amount}</span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {isPendingDoc && (
              <span className="pill-pending-doc flex items-center gap-1">
                <FileWarning size={9} /> NO FILE
              </span>
            )}
            {urgency === 'overdue' && (
              <span className="text-[10px] font-semibold text-red-400 flex items-center gap-0.5">
                <AlertTriangle size={10} /> {daysInStage}d
              </span>
            )}
            {urgency === 'warning' && (
              <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                <Clock size={10} /> {daysInStage}d
              </span>
            )}
          </div>
        </div>

        {/* Stage pill */}
        {doc.current_pending_stage && (
          <div className="mt-2">
            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', {
              'bg-red-500/10 text-red-400':    doc.current_pending_stage === 'fc_committee',
              'bg-blue-500/10 text-blue-400':  doc.current_pending_stage === 'coo',
              'bg-amber-50 text-amber-700':doc.current_pending_stage === 'treasury_finance',
              'bg-orange-500/10 text-orange-400': doc.current_pending_stage === 'legal',
              'bg-purple-500/10 text-purple-400': doc.current_pending_stage === 'board',
            })}>
              {doc.current_pending_stage === 'fc_committee'     ? '⏳ Pending FC'       :
               doc.current_pending_stage === 'coo'             ? '🔵 Pending COO'       :
               doc.current_pending_stage === 'treasury_finance' ? '🟡 Pending Treasury' :
               doc.current_pending_stage === 'legal'           ? '🔴 Pending Legal'     :
               doc.current_pending_stage === 'board'           ? '🟠 Pending BOD'       :
               doc.current_pending_stage}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Swimlane Column ───────────────────────────────────────────

function Swimlane({
  label, count, accent, docs, emptyText, addHref,
}: {
  label:     string
  count:     number
  accent:    'red' | 'amber' | 'blue' | 'green'
  docs:      ActivePipelineItem[]
  emptyText: string
  addHref?:  string
}) {
  const accentColors = {
    red:   'text-red-600',
    amber: 'text-amber-600',
    blue:  'text-blue-600',
    green: 'text-green-600',
  }
  const badgeColors = {
    red:   'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    blue:  'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
  }

  return (
    <div className="card flex flex-col overflow-hidden min-h-[380px] max-h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-default flex-shrink-0">
        <span className={clsx('font-syne font-bold text-[11px] uppercase tracking-wider', accentColors[accent])}>
          {label}
        </span>
        <span className={clsx('font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full', badgeColors[accent])}>
          {count}
        </span>
      </div>

      {/* Doc list */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
        {docs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[11px] text-dim text-center px-4">{emptyText}</p>
          </div>
        ) : (
          docs.map(doc => <DocCard key={doc.id} doc={doc} />)
        )}

        {addHref && (
          <Link
            href={addHref}
            className="flex items-center justify-center gap-1.5 p-2 border border-dashed border-gray-300 rounded-md text-[11px] text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
          >
            <Plus size={12} /> Add document
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard Client ─────────────────────────────────────

export function DashboardClient({
  user,
  org,
  metrics,
}: {
  user:    User
  org:     Organization
  metrics: DashboardMetrics
}) {
  const { data: pipeline = [], isLoading } = useQuery({
    queryKey: ['active-pipeline'],
    queryFn:  () => getActivePipeline({ is_on_hold: false }),
    refetchInterval: 30_000,  // refresh every 30s during meetings
  })

  // Sort into swimlanes
  const needsAction  = pipeline.filter(d => d.pipeline_status === 'pending_fc_review')
  const waiting      = pipeline.filter(d => ['pending_coo','pending_treasury','pending_legal','pending_finance_committee'].includes(d.pipeline_status))
  const pendingBOD   = pipeline.filter(d => d.pipeline_status === 'pending_bod')
  const recentClosed = pipeline.filter(d => d.pipeline_status === 'fully_executed').slice(0, 6)

  const pipelineValue = metrics.pipeline_value
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(metrics.pipeline_value)
    : '$—'

  // Wednesday meeting mode prompt
  const isWednesday = new Date().getDay() === 3

  return (
    <div className="p-6 space-y-6 stagger">

      {/* Wednesday prompt */}
      {isWednesday && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse-amber" />
            <span className="text-sm font-semibold text-blue-800">It's Wednesday — FAC meeting today at 2:30 PM CST</span>
          </div>
          <Link
            href="/meetings/fac/live"
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
          >
            Enter Meeting Mode <ChevronRight size={13} />
          </Link>
        </div>
      )}

      {/* Pending doc alert */}
      {metrics.overdue_submissions > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-orange-50 border border-orange-200">
          <div className="flex items-center gap-3">
            <FileWarning size={16} className="text-orange-600" />
            <span className="text-sm text-orange-700">
              <strong>{metrics.overdue_submissions} document{metrics.overdue_submissions > 1 ? 's' : ''}</strong> on tracker with no file received — past Tuesday 3 PM deadline
            </span>
          </div>
          <Link href="/pending" className="text-xs font-bold text-orange-600 hover:underline">
            View all →
          </Link>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-3">
        <MetricCard
          icon="🔴" accent="red"
          value={metrics.needs_fc_review}
          label="Needs FC Review"
          sub="Pending committee decision"
          href="/documents?status=pending_fc_review"
        />
        <MetricCard
          icon="⏳" accent="amber"
          value={metrics.waiting_on_others}
          label="Waiting on Others"
          sub="COO · Treasury · Legal"
          href="/documents?status=waiting"
        />
        <MetricCard
          icon="🏛" accent="blue"
          value={metrics.pending_bod}
          label="Going to Board"
          sub="Needs BOD approval"
          href="/bod"
        />
        <MetricCard
          icon="💰" accent="purple"
          value={pipelineValue}
          label="In-Flight Value"
          sub="Active pipeline"
        />
        <MetricCard
          icon="✅" accent="green"
          value={metrics.fully_executed}
          label="Executed This Cycle"
          sub="25-26 school year"
          href="/archived"
        />
      </div>

      {/* Swimlanes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-syne font-bold text-sm text-default">Approval Pipeline</h2>
          <Link
            href="/documents/new"
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            <Plus size={13} /> Submit Document
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="card h-80 animate-pulse bg-surface-2" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            <Swimlane
              label="🔴 Needs FC Action"
              accent="red"
              count={needsAction.length}
              docs={needsAction}
              emptyText="No items pending FC review"
              addHref="/documents/new"
            />
            <Swimlane
              label="⏳ Waiting on Others"
              accent="amber"
              count={waiting.length}
              docs={waiting}
              emptyText="No items waiting on approvers"
            />
            <Swimlane
              label="🏛 Pending BOD"
              accent="blue"
              count={pendingBOD.length}
              docs={pendingBOD}
              emptyText="No items pending board approval"
            />
            <Swimlane
              label="✅ Recently Closed"
              accent="green"
              count={recentClosed.length}
              docs={recentClosed}
              emptyText="No recently closed items"
            />
          </div>
        )}
      </div>

    </div>
  )
}
