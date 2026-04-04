'use client'

import { clsx } from 'clsx'
import { CheckCircle2, Clock, XCircle, MinusCircle, AlertCircle, ChevronRight, Plus, Check } from 'lucide-react'
import type { Approval, ActionItem, ApprovalStage, ApprovalStatus, PipelineStatus, DocFileStatus } from '@/types'
import { APPROVAL_STAGE_LABELS, APPROVAL_STATUS_LABELS, PIPELINE_STATUS_LABELS } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'
import { completeActionItem } from '@/lib/data'
import { useState } from 'react'

// ── Pipeline Status Badge ─────────────────────────────────────

export function PipelineBadge({ status }: { status: PipelineStatus }) {
  const config: Record<PipelineStatus, { cls: string; dot: string }> = {
    pending_fc_review:         { cls: 'bg-red-500/10 text-red-400 border-red-500/20',       dot: 'bg-red-400' },
    pending_coo:               { cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',     dot: 'bg-blue-400' },
    pending_treasury:          { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',  dot: 'bg-amber-400' },
    pending_legal:             { cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20', dot: 'bg-orange-400' },
    pending_finance_committee: { cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20', dot: 'bg-orange-400' },
    pending_bod:               { cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20', dot: 'bg-purple-400' },
    pending_execution:         { cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',     dot: 'bg-blue-400' },
    fully_executed:            { cls: 'bg-green-500/10 text-green-400 border-green-500/20',  dot: 'bg-green-400' },
    on_hold:                   { cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20', dot: 'bg-orange-400' },
    denied:                    { cls: 'bg-red-500/10 text-red-400 border-red-500/20',        dot: 'bg-red-400' },
    archived:                  { cls: 'bg-surface-2 text-dim border-default',                dot: 'bg-dim' },
  }
  const { cls, dot } = config[status] ?? config.pending_fc_review
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border', cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
      {PIPELINE_STATUS_LABELS[status]}
    </span>
  )
}

// ── File Status Badge ─────────────────────────────────────────

export function FileBadge({ status }: { status: string }) {
  if (status === 'pending_doc') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
        ⏳ PENDING DOC
      </span>
    )
  }
  if (status === 'received') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
        ✓ File Received
      </span>
    )
  }
  return null
}

// ── State Badge ───────────────────────────────────────────────

export function StateBadge({ state }: { state: string }) {
  const cls = {
    TX:     'state-tx',
    FL:     'state-fl',
    OH:     'state-oh',
    IPS_FL: 'state-fl',
    TX_IPS: 'state-tx',
  }[state] ?? 'state-tx'
  return <span className={cls}>{state}</span>
}

// ── Approval Status Icon ──────────────────────────────────────

function ApprovalIcon({ status }: { status: ApprovalStatus }) {
  if (['approved','approved_by_delegation','approved_pending_conditions'].includes(status))
    return <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
  if (status === 'denied')
    return <XCircle size={16} className="text-red-400 flex-shrink-0" />
  if (status === 'on_hold')
    return <AlertCircle size={16} className="text-orange-400 flex-shrink-0" />
  if (status === 'not_required')
    return <MinusCircle size={16} className="text-dim flex-shrink-0" />
  return <Clock size={16} className="text-amber-400 flex-shrink-0 animate-pulse" />
}

// ── Approval Timeline ─────────────────────────────────────────

export function ApprovalTimeline({ approvals }: { approvals: Approval[] }) {
  const sorted = [...approvals].sort((a, b) => a.stage_order - b.stage_order)

  return (
    <div className="space-y-1">
      {sorted.map((approval, i) => {
        const isApproved   = ['approved','approved_by_delegation','approved_pending_conditions'].includes(approval.status)
        const isPending    = approval.status === 'pending'
        const isNotRequired = approval.status === 'not_required'

        return (
          <div key={approval.id} className="flex gap-3">
            {/* Line + icon */}
            <div className="flex flex-col items-center">
              <ApprovalIcon status={approval.status} />
              {i < sorted.length - 1 && (
                <div className={clsx(
                  'w-px flex-1 mt-1 mb-1 min-h-[16px]',
                  isApproved ? 'bg-green-500/30' : 'bg-surface-3'
                )} />
              )}
            </div>

            {/* Content */}
            <div className={clsx(
              'flex-1 pb-3',
              isNotRequired && 'opacity-40'
            )}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[12px] font-semibold text-default">
                    {APPROVAL_STAGE_LABELS[approval.stage]}
                  </div>
                  {approval.approver_name && (
                    <div className="text-[11px] text-muted mt-0.5">{approval.approver_name}</div>
                  )}
                  {approval.conditions && (
                    <div className="text-[11px] text-orange-400 mt-1 bg-orange-500/10 rounded px-2 py-1">
                      Conditions: {approval.conditions}
                    </div>
                  )}
                  {approval.ticket_number && (
                    <div className="text-[10px] font-mono text-blue-400 mt-1">
                      {approval.ticket_number}
                    </div>
                  )}
                  {approval.notes && (
                    <div className="text-[11px] text-muted mt-1 italic">{approval.notes}</div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {isApproved && approval.approved_at && (
                    <div className="text-[10px] text-green-400 font-mono">
                      {format(new Date(approval.approved_at), 'MM/dd/yy')}
                    </div>
                  )}
                  {isPending && approval.days_at_stage > 0 && (
                    <div className={clsx(
                      'text-[10px] font-mono font-bold',
                      approval.is_overdue ? 'text-red-400' : 'text-amber-400'
                    )}>
                      {approval.days_at_stage}d {approval.is_overdue ? '⚠ overdue' : ''}
                    </div>
                  )}
                  {isNotRequired && (
                    <div className="text-[10px] text-dim">N/A</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Action Items List ─────────────────────────────────────────

export function ActionItemsList({
  items,
  onItemCompleted,
}: {
  items: ActionItem[]
  onItemCompleted?: (id: string) => void
}) {
  const [completing, setCompleting] = useState<string | null>(null)

  async function handleComplete(id: string) {
    setCompleting(id)
    try {
      await completeActionItem(id)
      onItemCompleted?.(id)
    } finally {
      setCompleting(null)
    }
  }

  const open   = items.filter(i => i.status !== 'complete' && i.status !== 'cancelled')
  const closed = items.filter(i => i.status === 'complete' || i.status === 'cancelled')

  if (items.length === 0) {
    return <p className="text-xs text-dim italic">No action items</p>
  }

  return (
    <div className="space-y-1.5">
      {open.map(item => (
        <div
          key={item.id}
          className={clsx(
            'flex items-start gap-2.5 p-2.5 rounded-md bg-surface-2 border border-default group',
            item.days_overdue > 0 && 'border-red-500/20 bg-red-500/5'
          )}
        >
          <button
            onClick={() => handleComplete(item.id)}
            disabled={completing === item.id}
            className={clsx(
              'w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors',
              'border-default hover:border-amber-400 hover:bg-amber-500/10',
              completing === item.id && 'opacity-50'
            )}
          >
            {completing === item.id && <Check size={10} className="text-amber-400" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-default leading-snug">{item.description}</div>
            <div className="flex items-center gap-3 mt-1">
              {item.assigned_to_name && (
                <span className="text-[10px] text-muted">→ {item.assigned_to_name}</span>
              )}
              {item.due_date && (
                <span className={clsx(
                  'text-[10px] font-mono',
                  item.days_overdue > 0 ? 'text-red-400' : 'text-dim'
                )}>
                  {item.days_overdue > 0 ? `${item.days_overdue}d overdue` : format(new Date(item.due_date), 'MM/dd')}
                </span>
              )}
              <span className={clsx('text-[9px] font-bold uppercase', {
                'text-red-400':    item.priority === 'urgent',
                'text-orange-400': item.priority === 'high',
                'text-amber-400':  item.priority === 'medium',
                'text-dim':        item.priority === 'low',
              })}>
                {item.priority}
              </span>
            </div>
          </div>
        </div>
      ))}
      {closed.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] text-dim cursor-pointer select-none hover:text-muted">
            {closed.length} completed
          </summary>
          <div className="space-y-1 mt-1">
            {closed.map(item => (
              <div key={item.id} className="flex items-start gap-2.5 p-2 opacity-50">
                <CheckCircle2 size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-[11px] text-muted line-through">{item.description}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────

export function EmptyState({
  icon, title, description, action,
}: {
  icon:         string
  title:        string
  description?: string
  action?:      React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-syne font-bold text-base text-default mb-2">{title}</h3>
      {description && <p className="text-sm text-muted max-w-sm mb-6">{description}</p>}
      {action}
    </div>
  )
}

// ── Page Header ───────────────────────────────────────────────

export function PageHeader({
  title, subtitle, actions,
}: {
  title:     string
  subtitle?: string
  actions?:  React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between px-6 pt-6 pb-4">
      <div>
        <h1 className="font-syne font-bold text-xl text-default">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}

// ── Section Card ──────────────────────────────────────────────

export function SectionCard({
  title, children, action, className,
}: {
  title:      string
  children:   React.ReactNode
  action?:    React.ReactNode
  className?: string
}) {
  return (
    <div className={clsx('card overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-default">
        <span className="font-syne font-bold text-xs uppercase tracking-wider text-muted">{title}</span>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Amount display ────────────────────────────────────────────

export function Amount({ value }: { value: number | null }) {
  if (value == null) return <span className="text-dim">—</span>
  const formatted = Math.abs(value).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
  })
  const isCredit = value < 0
  return (
    <span className={clsx('font-mono font-semibold', isCredit ? 'text-green-400' : 'text-amber-400')}>
      {isCredit ? `(${formatted})` : formatted}
    </span>
  )
}
