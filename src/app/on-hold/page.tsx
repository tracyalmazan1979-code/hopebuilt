// ── /on-hold/page.tsx ─────────────────────────────────────────

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, EmptyState, StateBadge, PipelineBadge, Amount } from '@/components/ui'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default async function OnHoldPage() {
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

  const [userResult, docsResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', au.id).single(),
    supabase.from('documents')
      .select('*, approvals(stage, status)')
      .eq('is_on_hold', true)
      .eq('is_archived', false)
      .order('on_hold_since', { ascending: true }),
  ])

  if (!userResult.data) redirect('/auth/login')
  const docs = docsResult.data ?? []

  return (
    <AppShell user={userResult.data} org={userResult.data.organizations} title="On Hold">
      <div className="p-6 space-y-4">
        <PageHeader
          title="⏸ On Hold"
          subtitle={`${docs.length} item${docs.length !== 1 ? 's' : ''} currently on hold`}
        />

        {docs.length === 0 ? (
          <EmptyState icon="✅" title="No items on hold" description="All active items are moving through the approval pipeline." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-2 border-b border-default">
                  {['ST','Campus / Project','Type','Amount','On Hold Since','Reason','Pipeline'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-dim">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc: any, i: number) => (
                  <tr
                    key={doc.id}
                    className="border-b border-default hover:bg-surface-2 cursor-pointer transition-colors"
                    onClick={() => window.location.href = `/documents/${doc.id}`}
                  >
                    <td className="px-4 py-3"><StateBadge state={doc.state} /></td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-default">{doc.campus_name}</div>
                      {doc.presenter_name && <div className="text-xs text-dim">{doc.presenter_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{doc.document_type_name}</td>
                    <td className="px-4 py-3"><Amount value={doc.amount} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {doc.on_hold_since
                        ? formatDistanceToNow(new Date(doc.on_hold_since), { addSuffix: true })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted max-w-[200px]">
                      <span className="line-clamp-2">{doc.on_hold_reason ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3"><PipelineBadge status={doc.pipeline_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
