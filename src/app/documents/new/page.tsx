import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { SubmitDocumentForm } from '@/components/documents/SubmitDocumentForm'
import { QuickAddForm } from '@/components/documents/QuickAddForm'
import { NewDocumentTabs } from '@/components/documents/NewDocumentTabs'

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

  const documentTypes = docTypesResult.data ?? []
  const campuses = campusesResult.data ?? []
  const meetings = meetingsResult.data ?? []

  return (
    <AppShell user={profile} org={profile.organizations} title="Add Document">
      <div className="p-6">
        <NewDocumentTabs
          submitForm={
            <SubmitDocumentForm
              documentTypes={documentTypes}
              campuses={campuses}
              meetings={meetings}
            />
          }
          quickAddForm={
            <QuickAddForm
              documentTypes={documentTypes}
              campuses={campuses}
            />
          }
        />
      </div>
    </AppShell>
  )
}
