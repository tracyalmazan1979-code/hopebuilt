import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set(name, value, options)
        },
        remove(name, options) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  const [userResult, metricsResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', authUser.id).single(),
    supabase.from('v_dashboard_metrics').select('*').maybeSingle(),
  ])

  // User is authenticated but doesn't have a profile row yet
  const user = userResult.data ?? {
    id: authUser.id,
    email: authUser.email,
    full_name: authUser.email,
    role: 'viewer',
    org_id: null,
    organizations: null,
  }
  const org = user.organizations ?? null
  const metrics = metricsResult.data ?? {
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
