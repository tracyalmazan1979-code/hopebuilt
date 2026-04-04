// ── /bod/page.tsx ─────────────────────────────────────────────

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, EmptyState, Amount, PipelineBadge, StateBadge } from '@/components/ui'
import { format, differenceInDays } from 'date-fns'
import Link from 'next/link'
import { clsx } from 'clsx'

async function getUserAndOrg(supabase: any, uid: string) {
  const { data } = await supabase.from('users').select('*, organizations(*)').eq('id', uid).single()
  return data
}

export default async function BODPage() {
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

  const [user, bodItems, upcomingMeetings] = await Promise.all([
    getUserAndOrg(supabase, au.id),
    supabase.from('bod_items').select(`
      *,
      documents(campus_name, document_type_name, amount, state, pipeline_status, submitter_type, presenter_name)
    `).is('board_approved', null).order('created_at', { ascending: true }),
    supabase.from('meetings').select('*, bod_items(count)')
      .eq('meeting_type', 'bod')
      .gte('meeting_date', new Date().toISOString().split('T')[0])
      .order('meeting_date', { ascending: true })
      .limit(5),
  ])

  if (!user) redirect('/auth/login')

  const items = bodItems.data ?? []
  const meetings = upcomingMeetings.data ?? []

  // Group items by board entity
  const byEntity: Record<string, typeof items> = {}
  items.forEach((item: any) => {
    const entity = item.board_entity ?? 'Unassigned'
    if (!byEntity[entity]) byEntity[entity] = []
    byEntity[entity].push(item)
  })

  const totalValue = items.reduce((sum: number, i: any) => sum + (i.documents?.amount ?? 0), 0)

  return (
    <AppShell user={user} org={user.organizations} title="BOD Items">
      <div className="p-6 space-y-6">
        <PageHeader
          title="🏛 Board of Directors Items"
          subtitle={`${items.length} items pending board approval · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue)} total value`}
        />

        {/* Upcoming meetings */}
        {meetings.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {meetings.map((m: any) => {
              const daysUntil = differenceInDays(new Date(m.meeting_date), new Date())
              return (
                <div key={m.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-syne font-bold text-sm text-default">{m.title}</div>
                      <div className="text-xs text-muted mt-1">
                        {format(new Date(m.meeting_date), 'EEEE, MMMM d, yyyy')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={clsx(
                        'font-mono text-lg font-black',
                        daysUntil <= 7 ? 'text-red-400' : daysUntil <= 14 ? 'text-amber-400' : 'text-muted'
                      )}>
                        {daysUntil}d
                      </div>
                      <div className="text-[10px] text-dim">until BOD</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Items by entity */}
        {items.length === 0 ? (
          <EmptyState icon="🏛" title="No items pending board approval" description="All documents requiring board approval have been voted on." />
        ) : (
          Object.entries(byEntity).map(([entity, entityItems]) => {
            const entityTotal = entityItems.reduce((s, i: any) => s + (i.documents?.amount ?? 0), 0)
            return (
              <div key={entity}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="font-syne font-bold text-sm text-default">{entity}</div>
                    <span className="font-mono text-[10px] bg-surface-2 text-muted px-2 py-0.5 rounded-full border border-default">
                      {entityItems.length} item{entityItems.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="font-syne font-bold text-amber-400">
                    <Amount value={entityTotal} />
                  </div>
                </div>
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-2 border-b border-default">
                        {['ST','Campus / Project','Document Type','Amount','Item Type','Pipeline'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-dim">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(entityItems as any[]).map((item, i) => (
                        <tr
                          key={item.id}
                          className={clsx('border-b border-default hover:bg-surface-2 cursor-pointer transition-colors', i % 2 === 0 ? '' : 'bg-surface/30')}
                          onClick={() => window.location.href = `/documents/${item.document_id}`}
                        >
                          <td className="px-3 py-3"><StateBadge state={item.documents?.state ?? 'TX'} /></td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-sm text-default">{item.documents?.campus_name}</div>
                            <div className="text-[10px] text-dim">{item.documents?.presenter_name}</div>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted">{item.documents?.document_type_name}</td>
                          <td className="px-3 py-3"><Amount value={item.documents?.amount} /></td>
                          <td className="px-3 py-3 text-xs text-muted capitalize">{item.item_type?.replace(/_/g,' ')}</td>
                          <td className="px-3 py-3">
                            <PipelineBadge status={item.documents?.pipeline_status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>
    </AppShell>
  )
}
