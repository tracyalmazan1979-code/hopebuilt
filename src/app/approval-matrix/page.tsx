import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui'
import { clsx } from 'clsx'

const STAGE_LABELS: Record<string, string> = {
  fc_committee:       'FC',
  coo:                'COO',
  treasury_finance:   'Treasury',
  legal:              'Legal',
  finance_committee:  'Fin. Comm.',
  board:              'BOD',
}

const ALL_STAGES = ['fc_committee','coo','treasury_finance','legal','finance_committee','board']

export default async function ApprovalMatrixPage() {
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

  const [userResult, docTypesResult] = await Promise.all([
    supabase.from('users').select('*, organizations(*)').eq('id', au.id).single(),
    supabase.from('document_types').select('*').eq('is_active', true).order('name'),
  ])
  if (!userResult.data) redirect('/auth/login')

  const docTypes = docTypesResult.data ?? []

  return (
    <AppShell user={userResult.data} org={userResult.data.organizations} title="Approval Matrix">
      <div className="p-6 space-y-6">
        <PageHeader
          title="Approval Matrix"
          subtitle="Required approval stages by document type — per IDEA F&C governance rules"
        />

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-2 border-b border-default">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-dim">Document Type</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-dim">Abv.</th>
                {ALL_STAGES.map(s => (
                  <th key={s} className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-dim">
                    {STAGE_LABELS[s]}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-dim">BOD $</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-amber-400/70">Wet Sig</th>
              </tr>
            </thead>
            <tbody>
              {docTypes.map((dt: any, i: number) => (
                <tr
                  key={dt.id}
                  className={clsx('border-b border-default', i % 2 === 0 ? 'bg-app' : 'bg-surface/40')}
                >
                  <td className="px-4 py-3 font-semibold text-sm text-default">{dt.name}</td>
                  <td className="px-3 py-3 text-center font-mono text-[10px] text-muted">{dt.abbreviation}</td>
                  {ALL_STAGES.map(stage => {
                    const required = dt.approval_stages?.includes(stage)
                    return (
                      <td key={stage} className="px-3 py-3 text-center">
                        {required ? (
                          <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-bold">
                            ✓
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center w-5 h-5 text-dim text-[10px]">
                            —
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-3 text-center text-[11px] text-muted">
                    {dt.bod_amount_threshold != null
                      ? `>$${dt.bod_amount_threshold.toLocaleString()}`
                      : dt.requires_bod
                      ? 'Always'
                      : '—'
                    }
                  </td>
                  <td className="px-3 py-3 text-center">
                    {dt.requires_wet_signature
                      ? <span className="text-[10px] font-bold text-amber-400">Required</span>
                      : <span className="text-dim text-[10px]">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Board approval criteria */}
        <div className="card p-5">
          <div className="font-syne font-bold text-xs uppercase tracking-wider text-muted mb-4">
            Board Approval Criteria
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              'Any contract over $50K',
              'Any change order over $50K',
              'Any document changing contract language',
              'Plat (mylar)',
              'Easements that convey land',
              'Final Retainage Pay Application',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-default">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* No committee needed */}
        <div className="card p-5">
          <div className="font-syne font-bold text-xs uppercase tracking-wider text-muted mb-4">
            Documents That Do NOT Require F&C Committee
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              'Benches and trash can proposals',
              'Permits/Applications (Elevator, Alarm, Fire, Gate, etc.)',
              'AEVR application',
              'SWPP application',
              'TDLR Owner Agent Designation',
              'Certificate of Substantial Completion',
              'Punch List Completion Acceptance Letter',
              'Notice of Intent',
              'Notice to Proceed',
              'Elevator Certificate',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted">
                <div className="w-1.5 h-1.5 rounded-full bg-dim flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
