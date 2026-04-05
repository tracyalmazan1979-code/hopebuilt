import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { TrackerClient } from '@/components/documents/TrackerClient'

export default async function TrackerPage() {
  const supabase = createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const [userResult, docsResult, metricsResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', authUser.id).single(),
    supabase.from('documents')
      .select(`
        *,
        approvals(stage, status, approver_name, ticket_number),
        bod_items(board_entity, board_approved, bod_meeting_id, meetings:bod_meeting_id(meeting_date)),
        meetings:meeting_id(meeting_date, meeting_type)
      `)
      .eq('is_archived', false)
      .order('fc_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('v_dashboard_metrics').select('*').single(),
  ])

  if (!userResult.data) redirect('/auth/login')

  return (
    <AppShell
      user={userResult.data}
      org={userResult.data.organizations}
      metrics={metricsResult.data}
      title="F&C Weekly Doc Review Tracker"
    >
      <TrackerClient documents={docsResult.data ?? []} />
    </AppShell>
  )
}
