import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { CalendarView } from '@/components/calendar/CalendarView'

export default async function CalendarPage() {
  const supabase = createClient()
  const { data: { user: au } } = await supabase.auth.getUser()
  if (!au) redirect('/auth/login')

  const [userResult, meetingsResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', au.id).single(),
    supabase.from('meetings').select('*').order('meeting_date', { ascending: true }),
  ])
  if (!userResult.data) redirect('/auth/login')

  // Fetch BOD items with their meeting dates
  const { data: bodItems } = await supabase
    .from('bod_items')
    .select('*, documents(campus_name, document_type_name, amount)')
    .eq('board_approved', false)

  // Fetch overdue approvals for deadline indicators
  const { data: overdueApprovals } = await supabase
    .from('approvals')
    .select('*, documents(campus_name, document_type_name)')
    .eq('is_overdue', true)
    .eq('status', 'pending')

  return (
    <AppShell user={userResult.data} org={userResult.data.organizations} title="Calendar">
      <CalendarView
        meetings={meetingsResult.data ?? []}
        bodItems={bodItems ?? []}
        overdueApprovals={overdueApprovals ?? []}
      />
    </AppShell>
  )
}
