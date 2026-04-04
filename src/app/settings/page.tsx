// ── /settings/page.tsx ───────────────────────────────────────

import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, SectionCard } from '@/components/ui'

export default async function SettingsPage() {
  const { supabase, profile } = await requireAuth('admin')

  const { data: recipients } = await supabase
    .from('agenda_recipients').select('*').order('full_name')

  const org     = profile.organizations
  const settings = org?.settings ?? {}

  return (
    <AppShell user={profile} org={org} title="Settings">
      <div className="p-6 space-y-6 max-w-3xl">
        <PageHeader title="Settings" subtitle="Organization configuration and preferences" />

        {/* Org Settings */}
        <SectionCard title="Organization">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              ['Organization Name', org?.name],
              ['Slug', org?.slug],
              ['Committee Name', settings.committee_name],
              ['Coordinator', settings.coordinator_name],
              ['BOD Entities', settings.bod_entities?.join(', ')],
              ['Fiscal Year Start', `Month ${settings.fiscal_year_start_month}`],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[10px] font-bold text-dim uppercase tracking-wider mb-0.5">{label}</dt>
                <dd className="text-sm text-default">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        {/* Deadline settings */}
        <SectionCard title="Deadline Configuration">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              ['Submission Deadline', `${settings.submission_deadline_day?.charAt(0).toUpperCase()}${settings.submission_deadline_day?.slice(1)} at ${settings.submission_deadline_hour_cst}:00 PM CST`],
              ['Nudge After', `${settings.nudge_after_business_days} business days`],
              ['BOD Amount Threshold', `$${settings.bod_amount_threshold?.toLocaleString()}`],
              ['BOD Packet Lead Time', `${settings.bod_packet_weeks_before} weeks before meeting`],
              ['Agenda Send Day', settings.agenda_send_day?.charAt(0).toUpperCase() + settings.agenda_send_day?.slice(1)],
              ['Agenda Send Time', `${settings.agenda_send_hour}:00 AM CST`],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[10px] font-bold text-dim uppercase tracking-wider mb-0.5">{label}</dt>
                <dd className="text-sm text-default">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-dim mt-4">
            To change these settings, update the <code className="text-amber-400">organizations.settings</code> JSONB column in Supabase.
            Settings changes take effect immediately.
          </p>
        </SectionCard>

        {/* Agenda Recipients */}
        <SectionCard title="Agenda Email Recipients">
          <div className="space-y-2">
            {(recipients ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-md border border-default">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-default">{r.full_name ?? r.email}</div>
                  <div className="text-xs text-muted">{r.email}</div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(r.submitter_types ?? []).map((st: string) => (
                    <span key={st} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                      {st.toUpperCase()}
                    </span>
                  ))}
                  {(r.meeting_types ?? []).map((mt: string) => (
                    <span key={mt} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-3 text-dim">
                      {mt.replace(/_/g,' ')}
                    </span>
                  ))}
                </div>
                <div className={`w-2 h-2 rounded-full ${r.is_active ? 'bg-green-400' : 'bg-dim'}`} />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-dim mt-3">
            Manage recipients in Supabase → Table Editor → agenda_recipients.
          </p>
        </SectionCard>

        {/* Edge Function Schedule */}
        <SectionCard title="Automation Schedule">
          <div className="space-y-2">
            {[
              { time: 'Monday 8:00 AM CST',    action: 'monday_reminder',  label: 'Weekly Submission Reminder',        color: '#60a5fa' },
              { time: 'Tuesday 3:00 PM CST',   action: 'deadline_check',   label: 'Pending Doc Deadline Alert',        color: '#f59e0b' },
              { time: 'Wednesday 7:00 AM CST', action: 'agenda_builder',   label: 'Agenda Builder (PMSI + IDEA + FAC)',color: '#4ade80' },
              { time: 'Daily 12:00 AM CST',    action: 'aging_refresh',    label: 'Approval Aging Refresh',            color: '#c084fc' },
            ].map(item => (
              <div key={item.action} className="flex items-center gap-3 p-2.5 bg-surface-2 rounded-md border border-default">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                <div className="w-36 font-mono text-[10px] text-muted flex-shrink-0">{item.time}</div>
                <div className="flex-1 text-xs text-default">{item.label}</div>
                <code className="text-[9px] text-dim bg-surface-3 px-2 py-0.5 rounded">{item.action}</code>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-dim mt-3">
            Configure schedules in Supabase Dashboard → Edge Functions → weekly-automation → Schedules.
          </p>
        </SectionCard>
      </div>
    </AppShell>
  )
}
