// ============================================================
// ALL PAGE SERVER COMPONENTS
// Each page: fetches data server-side, renders AppShell + client component
// ============================================================

// ─────────────────────────────────────────────────────────────
// /documents/new/page.tsx
// ─────────────────────────────────────────────────────────────
// src/app/documents/new/page.tsx

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { SubmitDocumentForm } from '@/components/documents/SubmitDocumentForm'
import { PageHeader } from '@/components/ui'

export async function generateMetadata() {
  return { title: 'Submit Document | F&C Command Center' }
}

export default async function NewDocumentPage() {
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
  if (!authUser) redirect('/auth/login')

  const [userResult, docTypesResult, campusesResult, meetingsResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', authUser.id).single(),
    supabase.from('document_types').select('*').eq('is_active', true).order('name'),
    supabase.from('campuses').select('*').eq('is_active', true).order('name'),
    supabase.from('meetings').select('id, title, meeting_date')
      .eq('meeting_type', 'fac_doc_rev')
      .gte('meeting_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('meeting_date', { ascending: false })
      .limit(8),
  ])

  if (!userResult.data) redirect('/auth/login')

  return (
    <AppShell user={userResult.data} org={userResult.data.organizations} title="Submit Document">
      <div className="p-6">
        <PageHeader
          title="Submit Document for Review"
          subtitle="PMSI or IDEA internal documents for FAC consideration"
        />
        <div className="mt-6">
          <SubmitDocumentForm
            documentTypes={docTypesResult.data ?? []}
            campuses={campusesResult.data ?? []}
            meetings={meetingsResult.data ?? []}
          />
        </div>
      </div>
    </AppShell>
  )
}
