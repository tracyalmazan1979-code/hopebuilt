'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, isToday } from 'date-fns'
import { clsx } from 'clsx'
import { Zap } from 'lucide-react'
import { EmptyState, StateBadge, FileBadge, Amount } from '@/components/ui'

const IPS_STATES = ['FL', 'OH', 'IPS_FL']
type OrgTab = 'all' | 'idea_tx' | 'ips'

export function FACMeetingsList({ meetings }: { meetings: any[] }) {
  const [orgTab, setOrgTab] = useState<OrgTab>('all')

  const filtered = meetings.filter(m => {
    if (orgTab === 'idea_tx') return m.state === 'TX' || m.state === 'TX_IPS'
    if (orgTab === 'ips')     return IPS_STATES.includes(m.state)
    return true
  })

  const counts = {
    all:     meetings.length,
    idea_tx: meetings.filter(m => m.state === 'TX' || m.state === 'TX_IPS').length,
    ips:     meetings.filter(m => IPS_STATES.includes(m.state)).length,
  }

  return (
    <>
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
              orgTab === t.v
                ? 'text-blue-400 border-blue-500'
                : 'text-muted border-transparent hover:text-default'
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

      {filtered.length === 0 ? (
        <EmptyState icon="📋" title="No FAC meetings" description="No meetings match this filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map(meeting => {
            const docs = meeting.documents ?? []
            const isTodayMeeting = isToday(new Date(meeting.meeting_date))
            const pendingDocs = docs.filter((d: any) => d.file_status === 'pending_doc').length

            return (
              <div key={meeting.id} className={clsx('card overflow-hidden', isTodayMeeting && 'border-amber-500/30 bg-amber-500/3')}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-default">
                  <div className="flex items-center gap-3">
                    {isTodayMeeting && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/15 border border-red-500/30">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-red-400">TODAY</span>
                      </div>
                    )}
                    {meeting.state && <StateBadge state={meeting.state} />}
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
    </>
  )
}
