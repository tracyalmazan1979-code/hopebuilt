import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { AllDocumentsClient } from '@/components/documents/AllDocumentsClient'

export default async function AllDocumentsPage({
  searchParams,
}: {
  searchParams: { status?: string; state?: string; q?: string }
}) {
  const supabase = createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const [userResult, docsResult, metricsResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', authUser.id).single(),
    supabase.from('documents')
      .select('*, approvals(stage, status, stage_order, is_overdue, days_at_stage), bod_items(board_approved)')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase.from('v_dashboard_metrics').select('*').single(),
  ])

  if (!userResult.data) redirect('/auth/login')

  return (
    <AppShell
      user={userResult.data}
      org={userResult.data.organizations}
      metrics={metricsResult.data}
      title="All Documents"
    >
      <AllDocumentsClient
        documents={docsResult.data ?? []}
        initialFilters={searchParams}
      />
    </AppShell>
  )
}
