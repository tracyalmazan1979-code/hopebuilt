// ── /meetings/fac/page.tsx ────────────────────────────────────

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { FACMeetingsList } from '@/components/meetings/FACMeetingsList'

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

        <FACMeetingsList meetings={meetings} />
      </div>
    </AppShell>
  )
}
