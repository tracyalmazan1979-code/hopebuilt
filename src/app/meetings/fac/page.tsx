// ── /meetings/fac/page.tsx ────────────────────────────────────

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, EmptyState, StateBadge, FileBadge, Amount } from '@/components/ui'
import { format, isToday, isFuture } from 'date-fns'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Zap } from 'lucide-react'

export default async function FACMeetingsPage() {
  const supabase = createClient()
  const { data: { user: au } } = await supabase.auth.getUser()
  if (!au) redirect('/auth/login')

  const [userResult, meetingsResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', au.id).single(),
    supabase.from('meetings')
      .select('*, documents(id, campus_name, state, amount, pipeline_status, file_status, document_type_name, submitter_type)')
      .eq('meeting_type', 'fac_doc_rev')
      .order('meeting_date', { ascending: false })
      .limit(30),
  ])

  if (!userResult.data) redirect('/auth/login')

  const meetings = meetingsResult.data ?? []

  return (
    <AppShell user={userResult.data} org={userResult.data.organizations} title="FAC Doc Review">
      <div className="p-6 space-y-6">
        <PageHeader
          title="FAC Document Review Meetings"
          subtitle="All weekly Facilities & Construction document review sessions"
          actions={
            <Link
              href="/meetings/fac/live"
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-red-500/15 border border-red-500/30 text-red-400 rounded-md hover:bg-red-500/20 transition-colors"
            >
              <Zap size={14} /> Enter Meeting Mode
            </Link>
          }
        />

        {meetings.length === 0 ? (
          <EmptyState icon="📋" title="No FAC meetings yet" description="FAC meetings will appear here once created." />
        ) : (
          <div className="space-y-3">
            {meetings.map(meeting => {
              const docs = meeting.documents ?? []
              const isTodayMeeting = isToday(new Date(meeting.meeting_date))
              const pendingDocs = docs.filter((d: any) => d.file_status === 'pending_doc').length

              return (
                <div key={meeting.id} className={clsx('card overflow-hidden', isTodayMeeting && 'border-amber-500/30 bg-amber-500/3')}>
                  {/* Meeting header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-default">
                    <div className="flex items-center gap-3">
                      {isTodayMeeting && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/15 border border-red-500/30">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          <span className="text-[10px] font-bold text-red-400">TODAY</span>
                        </div>
                      )}
                      <div>
                        <div className="font-syne font-bold text-sm text-default">
                          {format(new Date(meeting.meeting_date), 'EEEE, MMMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted">
                          {docs.length} document{docs.length !== 1 ? 's' : ''}
                          {pendingDocs > 0 && (
                            <span className="text-amber-400 ml-2">· {pendingDocs} pending file{pendingDocs > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isTodayMeeting && (
                        <Link
                          href={`/meetings/fac/live?meeting=${meeting.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-colors"
                        >
                          <Zap size={12} /> Meeting Mode
                        </Link>
                      )}
                      <Link
                        href={`/documents?meeting=${meeting.id}`}
                        className="text-xs text-muted hover:text-default border border-default px-3 py-1.5 rounded-md"
                      >
                        View All →
                      </Link>
                    </div>
                  </div>

                  {/* Document rows */}
                  {docs.length > 0 && (
                    <div className="divide-y divide-default">
                      {(docs as any[]).slice(0, 5).map((doc, i) => (
                        <Link key={doc.id} href={`/documents/${doc.id}`}>
                          <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors">
                            <div className="font-mono text-[10px] text-dim w-5">{i + 1}</div>
                            <StateBadge state={doc.state} />
                            {doc.submitter_type === 'pmsi' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">PMSI</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold text-default">{doc.campus_name}</span>
                              <span className="text-[10px] text-dim ml-2">{doc.document_type_name}</span>
                            </div>
                            <Amount value={doc.amount} />
                            {doc.file_status === 'pending_doc' && <FileBadge status="pending_doc" />}
                          </div>
                        </Link>
                      ))}
                      {docs.length > 5 && (
                        <div className="px-4 py-2 text-xs text-dim">
                          + {docs.length - 5} more documents
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
