import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { DocumentDetailClient } from '@/components/documents/DocumentDetailClient'

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const [userResult, docResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', authUser.id).single(),
    supabase.from('documents').select(`
      *,
      approvals(*),
      bod_items(*),
      action_items(*),
      meetings(id, title, meeting_date, meeting_type)
    `).eq('id', params.id).single(),
  ])

  if (!userResult.data) redirect('/auth/login')
  if (!docResult.data)  notFound()

  return (
    <AppShell
      user={userResult.data}
      org={userResult.data.organizations}
      title={docResult.data.campus_name ?? 'Document Detail'}
    >
      <DocumentDetailClient
        document={docResult.data as any}
        currentUser={userResult.data}
      />
    </AppShell>
  )
}
