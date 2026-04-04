// ============================================================
// POST /api/meetings/create
// Creates a new meeting record.
// Also populates FAC carryover items if it's a Tactical meeting
// linked to a FAC meeting.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { MeetingType, StateRegion } from '@/types'

export async function POST(request: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    meeting_date,
    meeting_type,
    state,
    linked_fac_meeting_id,
  }: {
    meeting_date:          string
    meeting_type:          MeetingType
    state?:                StateRegion
    linked_fac_meeting_id?: string
  } = body

  if (!meeting_date || !meeting_type) {
    return NextResponse.json({ error: 'meeting_date and meeting_type are required' }, { status: 400 })
  }

  // Build title
  const typeLabels: Record<MeetingType, string> = {
    fac_doc_rev: 'FAC Doc Rev',
    tactical:    'Tactical',
    bod:         'Board of Directors',
    predoc_pmsi: 'PMSI PreDoc Review',
    predoc_idea: 'IDEA PreDoc Review',
    layne_solo_review: 'Layne Solo Review',
  }

  const dateLabel = new Date(meeting_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const title = `${typeLabels[meeting_type] ?? meeting_type} — ${dateLabel}`

  // Get user's org
  const { data: userRow } = await supabase
    .from('users').select('org_id').eq('id', user.id).single()

  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Create meeting
  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      org_id:                userRow.org_id,
      meeting_date,
      meeting_type,
      state:                 state ?? null,
      title,
      linked_fac_meeting_id: linked_fac_meeting_id ?? null,
      coordinator_id:        user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If it's a Tactical meeting linked to a FAC meeting,
  // auto-populate FAC carryover items
  if (meeting_type === 'tactical' && linked_fac_meeting_id) {
    const { data: count } = await supabase
      .rpc('populate_tactical_fac_carryover', {
        p_tactical_meeting_id: meeting.id,
        p_fac_meeting_id:      linked_fac_meeting_id,
      })

    return NextResponse.json({
      success:  true,
      meeting,
      carryover_items_created: count ?? 0,
    })
  }

  return NextResponse.json({ success: true, meeting })
}
