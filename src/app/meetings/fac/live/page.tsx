import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LiveMeetingClient } from '@/components/LiveMeetingClient'

export default async function LiveMeetingPage({
  searchParams,
}: {
  searchParams: { meeting?: string; type?: string }
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

  const [userResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', au.id).single(),
  ])

  if (!userResult.data) redirect('/auth/login')

  // Get or find the meeting for today
  let meetingId = searchParams.meeting
  let meeting: any = null
  let documents: any[] = []

  if (!meetingId) {
    // Find today's FAC meeting
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_type', 'fac_doc_rev')
      .eq('meeting_date', today)
      .single()
    if (data) {
      meetingId = data.id
      meeting = data
    }
  } else {
    const { data } = await supabase.from('meetings').select('*').eq('id', meetingId).single()
    meeting = data
  }

  if (meetingId) {
    const { data } = await supabase
      .from('v_active_pipeline')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('days_in_current_stage', { ascending: false })
    documents = data ?? []
  }

  return (
    <LiveMeetingClient
      meeting={meeting}
      documents={documents}
      userId={au.id}
    />
  )
}
