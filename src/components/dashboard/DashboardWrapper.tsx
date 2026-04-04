'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export function DashboardWrapper() {
  const router = useRouter()
  const [loading,  setLoading]  = useState(true)
  const [user,     setUser]     = useState<any>(null)
  const [org,      setOrg]      = useState<any>(null)
  const [metrics,  setMetrics]  = useState<any>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/auth/login')
        return
      }

      const [userResult, metricsResult] = await Promise.all([
        supabase.from('users').select('*, organizations(*)').eq('id', authUser.id).single(),
        supabase.from('v_dashboard_metrics').select('*').single(),
      ])

      if (!userResult.data) {
        router.push('/auth/login')
        return
      }

      setUser(userResult.data)
      setOrg(userResult.data.organizations)
      setMetrics(metricsResult.data ?? {
        org_id: userResult.data.org_id,
        needs_fc_review: 0, waiting_on_others: 0, pending_bod: 0,
        pending_execution: 0, fully_executed: 0, on_hold: 0,
        pending_doc_count: 0, overdue_submissions: 0,
        pipeline_value: null, total_active: 0,
      })
      setLoading(false)
    }

    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-muted text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <AppShell user={user} org={org} metrics={metrics} title="⚡ Command Center">
      <DashboardClient user={user} org={org} metrics={metrics} />
    </AppShell>
  )
}
