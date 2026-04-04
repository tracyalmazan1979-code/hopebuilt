// ============================================================
// ALL PAGE SERVER COMPONENTS
// Each page: fetches data server-side, renders AppShell + client component
// ============================================================

// ─────────────────────────────────────────────────────────────
// /documents/new/page.tsx
// ─────────────────────────────────────────────────────────────
// src/app/documents/new/page.tsx

import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { SubmitDocumentForm } from '@/components/documents/SubmitDocumentForm'
import { PageHeader } from '@/components/ui'

export async function generateMetadata() {
  return { title: 'Submit Document | F&C Command Center' }
}

export default async function NewDocumentPage() {
  const { supabase, profile } = await requireAuth('coordinator')

  const [docTypesResult, campusesResult, meetingsResult] = await Promise.all([
    supabase.from('document_types').select('*').eq('is_active', true).order('name'),
    supabase.from('campuses').select('*').eq('is_active', true).order('name'),
    supabase.from('meetings').select('id, title, meeting_date')
      .eq('meeting_type', 'fac_doc_rev')
      .gte('meeting_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('meeting_date', { ascending: false })
      .limit(8),
  ])

  return (
    <AppShell user={profile} org={profile.organizations} title="Submit Document">
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
