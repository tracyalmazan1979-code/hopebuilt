import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { LeadershipClient } from '@/components/LeadershipClient'

export default async function LeadershipPage() {
  const { supabase, profile } = await requireAuth('leadership')

  const [metricsResult, pipelineResult, upcomingBOD, recentlyExecuted] = await Promise.all([
    supabase.from('v_dashboard_metrics').select('*').single(),
    // Count by pipeline stage for funnel
    supabase.from('documents')
      .select('pipeline_status, state, amount, submitter_type')
      .eq('is_archived', false)
      .eq('is_on_hold', false),
    // Upcoming BOD meetings with item counts
    supabase.from('meetings')
      .select('*, bod_items(id, documents(amount))')
      .eq('meeting_type', 'bod')
      .gte('meeting_date', new Date().toISOString().split('T')[0])
      .order('meeting_date', { ascending: true })
      .limit(5),
    // Recently executed (last 30 days)
    supabase.from('documents')
      .select('campus_name, document_type_name, amount, state, archived_at, submitter_type')
      .eq('is_archived', true)
      .gte('archived_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('archived_at', { ascending: false })
      .limit(20),
  ])

  return (
    <AppShell
      user={profile}
      org={profile.organizations}
      metrics={metricsResult.data}
      title="📊 Leadership View"
    >
      <LeadershipClient
        metrics={metricsResult.data}
        pipelineItems={pipelineResult.data ?? []}
        upcomingBOD={upcomingBOD.data ?? []}
        recentlyExecuted={recentlyExecuted.data ?? []}
      />
    </AppShell>
  )
}
