import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { TacticalTrackerClient } from '@/components/documents/TacticalTrackerClient'

export default async function TacticalTrackerPage() {
  const supabase = createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const [userResult, itemsResult, meetingsResult, metricsResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', authUser.id).single(),
    supabase.from('tactical_items')
      .select(`
        *,
        meetings:meeting_id(id, meeting_date, meeting_type, title, state)
      `)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase.from('meetings')
      .select('id, meeting_date, meeting_type, title, state')
      .in('meeting_type', ['tactical', 'fac_doc_rev'])
      .order('meeting_date', { ascending: false })
      .limit(50),
    supabase.from('v_dashboard_metrics').select('*').single(),
  ])

  if (!userResult.data) redirect('/auth/login')

  return (
    <AppShell
      user={userResult.data}
      org={userResult.data.organizations}
      metrics={metricsResult.data}
      title="F&C Weekly Tactical Tracker"
    >
      <TacticalTrackerClient
        items={itemsResult.data ?? []}
        meetings={meetingsResult.data ?? []}
        orgId={userResult.data.org_id}
      />
    </AppShell>
  )
}
