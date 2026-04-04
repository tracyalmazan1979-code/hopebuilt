'use client'

import { useRouter } from 'next/navigation'
import MeetingMode from '@/components/MeetingMode'

export function LiveMeetingClient({
  meeting,
  documents,
  userId,
}: {
  meeting:   any
  documents: any[]
  userId:    string
}) {
  const router = useRouter()

  if (!meeting) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🗓</div>
          <h2 className="font-syne font-bold text-lg text-default mb-2">No FAC Meeting Today</h2>
          <p className="text-sm text-muted mb-6">
            There's no FAC meeting scheduled for today. Meeting Mode is designed for Wednesday meetings.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm text-muted border border-default rounded-md hover:text-default"
            >
              Go Back
            </button>
            <a
              href="/meetings/fac"
              className="px-4 py-2 text-sm font-bold bg-amber-500 text-black rounded-md hover:bg-amber-400"
            >
              View All Meetings
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <div className="text-4xl mb-4">📭</div>
          <h2 className="font-syne font-bold text-lg text-default mb-2">No Documents on Agenda</h2>
          <p className="text-sm text-muted mb-6">
            This meeting doesn't have any active documents. Submit documents and link them to this meeting first.
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm text-muted border border-default rounded-md hover:text-default"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <MeetingMode
      meeting={meeting}
      documents={documents}
      userId={userId}
      onClose={() => router.push('/dashboard')}
    />
  )
}
