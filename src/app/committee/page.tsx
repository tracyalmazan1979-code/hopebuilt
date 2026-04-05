// ── /committee/page.tsx ───────────────────────────────────────

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, SectionCard } from '@/components/ui'

const COMMITTEE_MEMBERS = [
  {
    name:  'Layne Fisher',
    title: 'Chief Operating Officer',
    org:   'IDEA Public Schools TX',
    role:  'Approver · F&C Committee Member',
    initials: 'LF',
    color: '#1F4E79',
  },
  {
    name:  'Daniel Garza',
    title: 'VP of Facilities & Construction',
    org:   'IDEA Public Schools TX',
    role:  'Approver · F&C Committee Member',
    initials: 'DG',
    color: '#065f46',
  },
  {
    name:  'Sylvia Pena',
    title: 'Director of Construction',
    org:   'IPS / IDEA',
    role:  'Approver · F&C Committee Member',
    initials: 'SP',
    color: '#7c3aed',
  },
  {
    name:  'Andrew Stanton',
    title: 'Principal',
    org:   'PMSI',
    role:  'Approver · F&C Committee Member',
    initials: 'AS',
    color: '#92400e',
  },
  {
    name:  'Vanessa Rangel',
    title: 'Construction Project Manager',
    org:   'IDEA Public Schools TX',
    role:  'Coordinator · Meeting Secretary',
    initials: 'VR',
    color: '#9f1239',
  },
]

export default async function CommitteePage() {
  const supabase = createClient()
  const { data: { user: au } } = await supabase.auth.getUser()
  if (!au) redirect('/auth/login')

  const userResult = await supabase
    .from('users').select('*, organizations(*)').eq('id', au.id).single()
  if (!userResult.data) redirect('/auth/login')

  return (
    <AppShell user={userResult.data} org={userResult.data.organizations} title="Committee">
      <div className="p-6 space-y-6 max-w-4xl">
        <PageHeader
          title="Committee Members"
          subtitle="IDEA/IPS Facilities & Construction Committee"
        />

        <SectionCard title="Committee Purpose">
          <p className="text-sm text-default leading-relaxed">
            The Facilities & Construction Committee is focused on financial oversight and authorization
            related to construction projects. The VP of Treasury/CFO (TX) is responsible for ensuring
            compliance with fiscal policies, assisting in identifying and securing funding sources,
            facilitating project approvals, participating in contractor selection and evaluation,
            and authorizing key financial documents such as CEAs, Change Orders, ASAs, and final
            retainage pay applications.
          </p>
        </SectionCard>

        <div className="grid grid-cols-1 gap-3">
          {COMMITTEE_MEMBERS.map(member => (
            <div key={member.name} className="card p-4 flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-syne font-black text-sm text-white flex-shrink-0"
                style={{ background: member.color }}
              >
                {member.initials}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-default">{member.name}</div>
                <div className="text-xs text-muted">{member.title}</div>
                <div className="text-[10px] text-dim">{member.org}</div>
              </div>
              <div className="text-[11px] text-muted bg-surface-2 px-3 py-1 rounded-full border border-default">
                {member.role}
              </div>
            </div>
          ))}
        </div>

        <SectionCard title="Weekly Meeting Schedule">
          <div className="space-y-2">
            {[
              { time: 'Wednesday 9:00 AM CST',   label: 'PMSI PreDoc Review',         who: 'Tracy, Andrew, Stephanie, Bob + Vanessa, Sylvia', scope: 'PMSI documents only' },
              { time: 'Wednesday ~10:00 AM CST', label: 'IDEA Internal PreDoc Review', who: 'IDEA internal team + Vanessa, Sylvia',             scope: 'IDEA-managed docs only' },
              { time: 'Wednesday 2:30 PM CST',   label: 'FAC Committee Meeting',       who: 'Full committee',                                   scope: 'All documents' },
              { time: 'Wednesday or Thursday',   label: 'Tactical Meeting',            who: 'Committee + Layne',                                scope: 'FAC carryover + tactical items' },
            ].map(item => (
              <div key={item.label} className="flex gap-4 p-3 bg-surface-2 rounded-md border border-default">
                <div className="w-40 font-mono text-[10px] text-amber-400 flex-shrink-0 pt-0.5">{item.time}</div>
                <div>
                  <div className="text-xs font-semibold text-default">{item.label}</div>
                  <div className="text-[11px] text-muted">{item.who}</div>
                  <div className="text-[10px] text-dim">{item.scope}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  )
}
