import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { DocumentDetailClient } from '@/components/documents/DocumentDetailClient'

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string }
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

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  const [userResult, docResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', authUser.id).single(),
    supabase.from('documents').select(`
      *,
      approvals(* order by stage_order asc),
      bod_items(*),
      action_items(* order by created_at desc),
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
