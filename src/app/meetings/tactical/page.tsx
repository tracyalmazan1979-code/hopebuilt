import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { TacticalMeetingClient } from '@/components/TacticalMeetingClient'

export default async function TacticalPage({
  searchParams,
}: {
  searchParams: { meeting?: string }
}) {
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

  const { data: { user: au } } = await supabase.auth.getUser()
  if (!au) redirect('/auth/login')

  const [userResult, meetingsResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', au.id).single(),
    supabase.from('meetings')
      .select('*, tactical_items(count)')
      .in('meeting_type', ['tactical','fac_doc_rev'])
      .order('meeting_date', { ascending: false })
      .limit(20),
  ])

  if (!userResult.data) redirect('/auth/login')

  const selectedMeetingId = searchParams.meeting

  // Fetch tactical items for selected meeting
  let tacticalItems: any[] = []
  let facDocuments: any[] = []

  if (selectedMeetingId) {
    const [tacticalResult, selectedMeeting] = await Promise.all([
      supabase.from('v_tactical_with_fac').select('*').eq('meeting_id', selectedMeetingId),
      supabase.from('meetings').select('linked_fac_meeting_id').eq('id', selectedMeetingId).single(),
    ])
    tacticalItems = tacticalResult.data ?? []

    // If this tactical meeting is linked to a FAC, auto-populate FAC carryovers
    if (selectedMeeting.data?.linked_fac_meeting_id) {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('meeting_id', selectedMeeting.data.linked_fac_meeting_id)
        .order('doc_number', { ascending: true })
      facDocuments = data ?? []
    }
  }

  return (
    <AppShell user={userResult.data} org={userResult.data.organizations} title="Tactical Meeting">
      <TacticalMeetingClient
        meetings={meetingsResult.data ?? []}
        selectedMeetingId={selectedMeetingId}
        tacticalItems={tacticalItems}
        facDocuments={facDocuments}
        currentUser={userResult.data}
      />
    </AppShell>
  )
}
