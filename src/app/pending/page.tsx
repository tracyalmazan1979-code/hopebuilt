// ── /pending/page.tsx ─────────────────────────────────────────

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, EmptyState, Amount, FileBadge, StateBadge } from '@/components/ui'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { clsx } from 'clsx'

async function getUser(supabase: any, authUserId: string) {
  const { data } = await supabase.from('users').select('*, organizations(*)').eq('id', authUserId).single()
  return data
}

export default async function PendingDocsPage() {
  const supabase = createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const [user, pending] = await Promise.all([
    getUser(supabase, authUser.id),
    supabase.from('v_pending_docs').select('*'),
  ])

  if (!user) redirect('/auth/login')

  const docs = pending.data ?? []
  const overdue  = docs.filter((d: any) => d.is_past_deadline)
  const upcoming = docs.filter((d: any) => !d.is_past_deadline)

  return (
    <AppShell user={user} org={user.organizations} title="Pending Docs">
      <div className="p-6 space-y-6">
        <PageHeader
          title="⏳ Pending Documents"
          subtitle="Documents on the tracker with no file received yet"
        />

        {docs.length === 0 ? (
          <EmptyState
            icon="✅"
            title="All files received"
            description="No documents are currently pending file submission."
          />
        ) : (
          <>
            {overdue.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="font-syne font-bold text-sm text-red-400 uppercase tracking-wider">
                    Past Tuesday 3PM Deadline — {overdue.length} item{overdue.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {overdue.map((doc: any) => (
                    <PendingDocRow key={doc.id} doc={doc} overdue />
                  ))}
                </div>
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="font-syne font-bold text-sm text-amber-400 uppercase tracking-wider">
                    Awaiting File — {upcoming.length} item{upcoming.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {upcoming.map((doc: any) => (
                    <PendingDocRow key={doc.id} doc={doc} overdue={false} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}

function PendingDocRow({ doc, overdue }: { doc: any; overdue: boolean }) {
  return (
    <Link href={`/documents/${doc.id}`}>
      <div className={clsx(
        'card p-4 flex items-start gap-4 hover:bg-surface-2 transition-colors cursor-pointer',
        overdue && 'border-red-500/20 bg-red-500/3'
      )}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StateBadge state={doc.state} />
            {doc.submitter_type === 'pmsi' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">PMSI</span>
            )}
            {doc.is_urgent && <span className="text-[9px] font-bold text-red-400">🔥 URGENT</span>}
            <FileBadge status="pending_doc" />
          </div>
          <div className="font-semibold text-sm text-default">{doc.campus_name}</div>
          <div className="text-xs text-muted">{doc.document_type_name}</div>
          {doc.pmsi_personnel_names?.length > 0 && (
            <div className="text-[10px] text-dim mt-1">
              PMSI: {doc.pmsi_personnel_names.join(', ')}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <Amount value={doc.amount} />
          {doc.submission_deadline && (
            <div className={clsx('text-[10px] font-mono mt-1', overdue ? 'text-red-400' : 'text-muted')}>
              {overdue
                ? `${Math.round(doc.hours_past_deadline)}h past deadline`
                : `Due ${format(new Date(doc.submission_deadline), 'EEE h:mm a')}`
              }
            </div>
          )}
          {doc.fac_date && (
            <div className="text-[10px] text-dim">
              FAC: {format(new Date(doc.fac_date), 'MM/dd')}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
