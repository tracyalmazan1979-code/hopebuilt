import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  let { data: userRow } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', authUser.id)
    .single()

  // Auto-provision profile for existing auth users missing a users row
  if (!userRow) {
    const { data: defaultOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (defaultOrg) {
      await supabase.from('users').upsert({
        id: authUser.id,
        org_id: defaultOrg.id,
        full_name: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'User',
        email: authUser.email!,
        role: 'read_only',
      }, { onConflict: 'id' })

      const { data } = await supabase
        .from('users')
        .select('*, organizations(*)')
        .eq('id', authUser.id)
        .single()
      userRow = data
    }
  }

  const user = userRow ?? {
    id: authUser.id,
    email: authUser.email,
    full_name: authUser.email,
    role: 'read_only',
    org_id: null,
    organizations: null,
  }

  const { data: metricsData } = await supabase
    .from('v_dashboard_metrics')
    .select('*')
    .eq('org_id', user.org_id)
    .maybeSingle()
  const org = user.organizations ?? null
  const metrics = metricsData ?? {
    org_id: user.org_id,
    needs_fc_review: 0, waiting_on_others: 0, pending_bod: 0,
    pending_execution: 0, fully_executed: 0, on_hold: 0,
    pending_doc_count: 0, overdue_submissions: 0,
    pipeline_value: null, total_active: 0,
  }

  return (
    <AppShell user={user} org={org} metrics={metrics} title="⚡ Command Center">
      <DashboardClient user={user} org={org} metrics={metrics} />
    </AppShell>
  )
}
