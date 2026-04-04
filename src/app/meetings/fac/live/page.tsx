import { requireAuth } from '@/lib/auth'
import { LiveMeetingClient } from '@/components/LiveMeetingClient'

export default async function LiveMeetingPage({
  searchParams,
}: {
  searchParams: { meeting?: string; type?: string }
}) {
  const { supabase, authUser } = await requireAuth('approver')

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
      userId={authUser.id}
    />
  )
}
