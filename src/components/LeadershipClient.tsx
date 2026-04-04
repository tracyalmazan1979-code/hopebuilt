'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts'
import type { DashboardMetrics } from '@/types'
import { Amount, PageHeader, SectionCard } from '@/components/ui'
import { format, differenceInDays } from 'date-fns'
import { clsx } from 'clsx'

const STAGE_ORDER = [
  { key: 'pending_fc_review',         label: 'FC Review',       color: '#f87171' },
  { key: 'pending_coo',               label: 'COO',             color: '#60a5fa' },
  { key: 'pending_treasury',          label: 'Treasury',        color: '#fbbf24' },
  { key: 'pending_legal',             label: 'Legal',           color: '#fb923c' },
  { key: 'pending_finance_committee', label: 'Finance Comm.',   color: '#f97316' },
  { key: 'pending_bod',               label: 'Board',           color: '#c084fc' },
  { key: 'pending_execution',         label: 'Execution',       color: '#22d3ee' },
]

const STATE_COLORS: Record<string, string> = {
  TX: '#60a5fa',
  FL: '#4ade80',
  OH: '#c084fc',
}

function KPICard({
  label, value, sub, accent,
}: {
  label:  string
  value:  string | number
  sub?:   string
  accent: string
}) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      <div className="text-xs font-semibold text-muted mb-2">{label}</div>
      <div className="font-syne font-black text-3xl leading-none" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-dim mt-2 font-mono">{sub}</div>}
    </div>
  )
}

const CUSTOM_TOOLTIP_STYLE = {
  background: '#1C2230',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 6,
  color: '#E6EDF3',
  fontSize: 12,
  padding: '8px 12px',
}

export function LeadershipClient({
  metrics,
  pipelineItems,
  upcomingBOD,
  recentlyExecuted,
}: {
  metrics:          DashboardMetrics | null
  pipelineItems:    any[]
  upcomingBOD:      any[]
  recentlyExecuted: any[]
}) {
  // Funnel data
  const funnelData = useMemo(() => {
    return STAGE_ORDER.map(stage => ({
      name:  stage.label,
      count: pipelineItems.filter(d => d.pipeline_status === stage.key).length,
      value: pipelineItems
        .filter(d => d.pipeline_status === stage.key)
        .reduce((s, d) => s + Math.abs(d.amount ?? 0), 0),
      color: stage.color,
    })).filter(d => d.count > 0)
  }, [pipelineItems])

  // By state pie
  const stateData = useMemo(() => {
    const counts: Record<string, number> = {}
    pipelineItems.forEach(d => {
      counts[d.state] = (counts[d.state] ?? 0) + 1
    })
    return Object.entries(counts).map(([state, count]) => ({
      name: state, value: count, color: STATE_COLORS[state] ?? '#6b7280',
    }))
  }, [pipelineItems])

  // Monthly value (from recently executed)
  const executedValue = recentlyExecuted.reduce((s, d) => s + Math.abs(d.amount ?? 0), 0)

  const avgDays = useMemo(() => {
    const withDays = pipelineItems.filter(d =>
      d.pipeline_status === 'fully_executed' && d.archived_at && d.created_at
    )
    if (!withDays.length) return null
    const total = withDays.reduce((s, d) =>
      s + differenceInDays(new Date(d.archived_at), new Date(d.created_at)), 0
    )
    return Math.round(total / withDays.length)
  }, [pipelineItems])

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Leadership Dashboard"
        subtitle="Pipeline overview for COO / CFO · Auto-refreshes every 5 minutes"
      />

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Active Pipeline Value"
          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(metrics?.pipeline_value ?? 0)}
          sub="Across all active approvals"
          accent="#F59E0B"
        />
        <KPICard
          label="Executed Last 30 Days"
          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(executedValue)}
          sub={`${recentlyExecuted.length} documents closed`}
          accent="#4ADE80"
        />
        <KPICard
          label="Avg. Days to Execute"
          value={avgDays != null ? `${avgDays}d` : '—'}
          sub="From submission to execution"
          accent="#22D3EE"
        />
        <KPICard
          label="Overdue Approvals"
          value={metrics?.waiting_on_others ?? 0}
          sub={`${metrics?.pending_doc_count ?? 0} files missing`}
          accent="#F87171"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-[1fr_320px] gap-4">

        {/* Pipeline funnel */}
        <SectionCard title="Approval Pipeline — Items & Dollar Value">
          {funnelData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-dim">
              No active pipeline data
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {funnelData.map(stage => {
                const maxCount = Math.max(...funnelData.map(s => s.count))
                const pct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
                return (
                  <div key={stage.name} className="flex items-center gap-3">
                    <div className="text-[11px] text-muted w-28 flex-shrink-0">{stage.name}</div>
                    <div className="flex-1 h-6 bg-surface-2 rounded overflow-hidden relative">
                      <div
                        className="h-full rounded flex items-center px-2 transition-all duration-700"
                        style={{ width: `${Math.max(pct, 5)}%`, background: stage.color + '40', borderLeft: `3px solid ${stage.color}` }}
                      />
                    </div>
                    <div className="text-[11px] font-mono font-bold w-6 text-right" style={{ color: stage.color }}>
                      {stage.count}
                    </div>
                    <div className="text-[11px] font-mono text-dim w-24 text-right">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stage.value)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* By state */}
        <SectionCard title="Active Items by State">
          {stateData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-dim">No data</div>
          ) : (
            <div className="space-y-3 pt-2">
              {stateData.map(s => (
                <div key={s.name} className="flex items-center gap-3">
                  <div
                    className="text-[10px] font-bold px-2 py-0.5 rounded font-mono"
                    style={{ background: s.color + '20', color: s.color }}
                  >
                    {s.name}
                  </div>
                  <div className="flex-1 h-4 bg-surface-2 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(s.value / Math.max(...stateData.map(x => x.value))) * 100}%`,
                        background: s.color + '40',
                      }}
                    />
                  </div>
                  <div className="text-[11px] font-mono font-bold w-6 text-right" style={{ color: s.color }}>
                    {s.value}
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t border-default space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-dim">PMSI-managed</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {pipelineItems.filter(d => d.submitter_type === 'pmsi').length}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-dim">IDEA internal</span>
                  <span className="text-blue-400 font-mono font-bold">
                    {pipelineItems.filter(d => d.submitter_type === 'idea_internal').length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Upcoming BOD + Recently executed */}
      <div className="grid grid-cols-2 gap-4">

        {/* Upcoming BOD */}
        <SectionCard title="Upcoming Board Meetings">
          {upcomingBOD.length === 0 ? (
            <p className="text-sm text-dim">No upcoming board meetings scheduled</p>
          ) : (
            <div className="space-y-3">
              {upcomingBOD.map((meeting: any) => {
                const daysUntil = differenceInDays(new Date(meeting.meeting_date), new Date())
                const bodItems = meeting.bod_items ?? []
                const totalValue = bodItems.reduce(
                  (s: number, i: any) => s + Math.abs(i.documents?.amount ?? 0), 0
                )
                return (
                  <div key={meeting.id} className="flex items-start gap-3 p-3 bg-surface-2 rounded-md border border-default">
                    <div className={clsx(
                      'text-center flex-shrink-0 w-12 p-1 rounded-md',
                      daysUntil <= 7 ? 'bg-red-500/10' : daysUntil <= 14 ? 'bg-amber-500/10' : 'bg-surface-3'
                    )}>
                      <div className="text-[9px] text-dim uppercase">{format(new Date(meeting.meeting_date), 'MMM')}</div>
                      <div className={clsx(
                        'font-syne font-black text-xl leading-none',
                        daysUntil <= 7 ? 'text-red-400' : daysUntil <= 14 ? 'text-amber-400' : 'text-default'
                      )}>
                        {format(new Date(meeting.meeting_date), 'd')}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-default">{meeting.title}</div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {bodItems.length} item{bodItems.length !== 1 ? 's' : ''}
                        {totalValue > 0 && ` · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue)}`}
                      </div>
                    </div>
                    <div className={clsx(
                      'text-[10px] font-mono font-bold flex-shrink-0',
                      daysUntil <= 7 ? 'text-red-400' : 'text-muted'
                    )}>
                      {daysUntil}d
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Recently executed */}
        <SectionCard title="Executed — Last 30 Days">
          {recentlyExecuted.length === 0 ? (
            <p className="text-sm text-dim">No documents executed in the last 30 days</p>
          ) : (
            <div className="space-y-1.5">
              {recentlyExecuted.slice(0, 8).map((doc: any, i: number) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-default last:border-0">
                  <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0', {
                    'state-tx': doc.state === 'TX',
                    'state-fl': doc.state === 'FL',
                    'state-oh': doc.state === 'OH',
                  })}>
                    {doc.state}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-default truncate">{doc.campus_name}</div>
                    <div className="text-[10px] text-dim truncate">{doc.document_type_name}</div>
                  </div>
                  <Amount value={doc.amount} />
                </div>
              ))}
              {recentlyExecuted.length > 8 && (
                <div className="text-[11px] text-dim pt-1">+ {recentlyExecuted.length - 8} more</div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
