import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, EmptyState, StateBadge, Amount } from '@/components/ui'
import { format } from 'date-fns'

export default async function ArchivedPage() {
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
      .select('*, meetings(meeting_date)')
      .eq('is_archived', true)
      .order('archived_at', { ascending: false })
      .limit(100),
  ])

  if (!userResult.data) redirect('/auth/login')
  const docs = docsResult.data ?? []

  const totalValue = docs.reduce((s: number, d: any) => s + Math.abs(d.amount ?? 0), 0)

  return (
    <AppShell user={userResult.data} org={userResult.data.organizations} title="Archived Docs">
      <div className="p-6 space-y-4">
        <PageHeader
          title="📦 Archived Documents"
          subtitle={`${docs.length} executed documents · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue)} total value`}
        />

        {docs.length === 0 ? (
          <EmptyState icon="📦" title="No archived documents" description="Documents that have been fully executed and archived will appear here." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-2 border-b border-default">
                  {['Archived','ST','Campus / Project','Type','Amount','Funding Source','FC Outcome'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-dim whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc: any, i: number) => (
                  <tr
                    key={doc.id}
                    className="border-b border-default hover:bg-surface-2 cursor-pointer transition-colors opacity-80 hover:opacity-100"
                    onClick={() => window.location.href = `/documents/${doc.id}`}
                  >
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                      {doc.archived_at ? format(new Date(doc.archived_at), 'MM/dd/yy') : '—'}
                    </td>
                    <td className="px-4 py-2.5"><StateBadge state={doc.state} /></td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-sm text-default">{doc.campus_name}</div>
                      {doc.presenter_name && <div className="text-[10px] text-dim">{doc.presenter_name}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">{doc.document_type_name}</td>
                    <td className="px-4 py-2.5"><Amount value={doc.amount} /></td>
                    <td className="px-4 py-2.5 text-xs text-muted">{doc.funding_source ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {doc.fc_outcome && (
                        <span className="text-xs font-semibold text-green-400">{doc.fc_outcome}</span>
                      )}
                    </td>
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
