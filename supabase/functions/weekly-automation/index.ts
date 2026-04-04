// ============================================================
// HOPE BUILT ADVISORY — Weekly Automation Edge Function
// Supabase Edge Function: supabase/functions/weekly-automation
//
// Deploy: supabase functions deploy weekly-automation
//
// Schedule in Supabase Dashboard → Edge Functions → Schedules:
//   Monday    14:00 UTC (8AM CST)   → action=monday_reminder
//   Tuesday   21:00 UTC (3PM CST)   → action=deadline_check
//   Wednesday 13:00 UTC (7AM CST)   → action=agenda_builder
//   Wednesday 15:00 UTC (9AM CST)   → action=predoc_reminder
//   Daily     06:00 UTC (midnight CST) → action=aging_refresh
//
// Or invoke manually:
//   supabase functions invoke weekly-automation --body '{"action":"agenda_builder"}'
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { format } from 'npm:date-fns'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)
const APP_URL    = Deno.env.get('APP_URL') ?? 'https://app.hopebuiltadvisory.com'
const FROM_EMAIL = 'F&C Command Center <fac@hopebuiltadvisory.com>'

// ── Helpers ───────────────────────────────────────────────────

function formatCurrency(amount: number | null): string {
  if (amount == null) return '—'
  const abs = Math.abs(amount)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(abs)
  return amount < 0 ? `(${formatted})` : formatted
}

async function getRecipients(meetingTypes: string[], submitterTypes: string[]) {
  const { data } = await supabase
    .from('agenda_recipients')
    .select('*')
    .eq('is_active', true)

  return (data ?? []).filter((r: any) => {
    const hasMeetingType    = meetingTypes.some(mt => r.meeting_types?.includes(mt))
    const hasSubmitterType  = submitterTypes.some(st => r.submitter_types?.includes(st))
    return hasMeetingType && hasSubmitterType
  })
}

// ── Action: Refresh aging on approvals + action items ────────

async function refreshAging() {
  await supabase.rpc('refresh_approval_aging')
  await supabase.rpc('refresh_action_item_aging')
  return { success: true, action: 'aging_refresh' }
}

// ── Action: Monday reminder ───────────────────────────────────

async function mondayReminder() {
  // Find next Wednesday's FAC meeting
  const today = new Date()
  const daysUntilWed = (3 - today.getDay() + 7) % 7 || 7
  const nextWed = new Date(today)
  nextWed.setDate(today.getDate() + daysUntilWed)
  const facDateStr = nextWed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const tuesdayStr = new Date(nextWed.getTime() - 86400000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const recipients = await getRecipients(['fac_doc_rev','predoc_pmsi'], ['pmsi','idea_internal'])

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
    <div style="background:#1F4E79;padding:20px 24px;border-radius:8px 8px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:16px;">📋 Weekly FAC Submission Reminder</h2>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p style="color:#374151;font-size:14px;margin:0 0 16px;">
        This is your weekly reminder for the <strong>FAC Document Review — ${facDateStr}</strong>.
      </p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-bottom:16px;">
        <p style="margin:0;font-size:14px;color:#92400e;">
          <strong>📅 Submission Deadline: ${tuesdayStr} at 3:00 PM CST</strong>
        </p>
      </div>
      <p style="font-size:13px;color:#374151;margin:0 0 12px;">
        Please submit all documents through the F&C Command Center before the deadline.
        If a document isn't ready, <strong>submit the record as PENDING DOC</strong> — 
        the file can follow. The tracker entry is what matters for agenda planning.
      </p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin-bottom:20px;">
        <p style="margin:0;font-size:12px;color:#0369a1;">
          <strong>Wednesday Schedule:</strong><br>
          9:00 AM CST — PMSI PreDoc Review<br>
          2:30 PM CST — FAC Committee Meeting
        </p>
      </div>
      <a href="${APP_URL}/documents/new" style="display:inline-block;background:#F59E0B;color:#000;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;">
        Submit Document →
      </a>
    </div>
  </div>`

  let sent = 0
  for (const r of recipients) {
    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      `${r.full_name ?? ''} <${r.email}>`,
      subject: `📋 FAC Submission Deadline — ${tuesdayStr} 3PM CST`,
      html,
    })
    sent++
  }

  return { success: true, action: 'monday_reminder', sent, recipients: sent }
}

// ── Action: Tuesday 3PM deadline check ───────────────────────

async function deadlineCheck() {
  const { data: overdue } = await supabase
    .from('v_pending_docs')
    .select('*')
    .eq('is_past_deadline', true)

  if (!overdue?.length) return { success: true, action: 'deadline_check', overdue: 0 }

  // Get coordinator emails
  const { data: coordinators } = await supabase
    .from('users')
    .select('email, full_name')
    .in('role', ['admin', 'coordinator'])

  const listHtml = overdue.map((d: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${d.state}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;">${d.campus_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${d.document_type_name ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${d.presenter_name ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;font-family:monospace;color:#dc2626;">
        ${Math.round(d.hours_past_deadline ?? 0)}h overdue
      </td>
    </tr>
  `).join('')

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
    <div style="background:#b91c1c;padding:16px 24px;border-radius:8px 8px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:16px;">⚠ Pending Doc Alert — ${overdue.length} File${overdue.length > 1 ? 's' : ''} Missing</h2>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p style="font-size:13px;color:#374151;margin:0 0 16px;">
        The Tuesday 3:00 PM CST deadline has passed. The following documents are on the tracker 
        but <strong>no file has been received yet</strong>. These must be resolved before 
        Wednesday's 9:00 AM PreDoc Review.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">ST</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Campus</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Type</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Submitter</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Status</th>
          </tr>
        </thead>
        <tbody>${listHtml}</tbody>
      </table>
      <div style="margin-top:20px;">
        <a href="${APP_URL}/pending" style="display:inline-block;background:#F59E0B;color:#000;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;">
          View Pending Docs →
        </a>
      </div>
    </div>
  </div>`

  for (const coord of (coordinators ?? [])) {
    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      `${coord.full_name} <${coord.email}>`,
      subject: `⚠ ${overdue.length} Pending Doc${overdue.length > 1 ? 's' : ''} — Past Tuesday 3PM Deadline`,
      html,
    })
  }

  return { success: true, action: 'deadline_check', overdue: overdue.length }
}

// ── Action: Wednesday agenda builder ─────────────────────────

async function agendaBuilder() {
  // Get this Wednesday's FAC meeting (or create one)
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('meeting_type', 'fac_doc_rev')
    .eq('meeting_date', todayStr)
    .single()

  // Get all documents for this week's FAC
  let query = supabase
    .from('documents')
    .select('*')
    .eq('is_archived', false)
    .eq('is_on_hold', false)
    .order('state', { ascending: true })
    .order('doc_number', { ascending: true })

  if (meeting) query = query.eq('meeting_id', meeting.id)

  const { data: docs } = await query

  if (!docs?.length) return { success: true, action: 'agenda_builder', docs: 0, message: 'No documents for agenda' }

  // Split by submitter type
  const pmsiDocs  = docs.filter(d => d.submitter_type === 'pmsi')
  const ideaDocs  = docs.filter(d => d.submitter_type === 'idea_internal')

  // Build PMSI agenda
  const pmsiRecipients = await getRecipients(['predoc_pmsi'], ['pmsi'])
  if (pmsiDocs.length > 0 && pmsiRecipients.length > 0) {
    const pmsiHtml = buildAgendaEmail(pmsiDocs, 'PMSI PreDoc Review', '9:00 AM CST', today)
    for (const r of pmsiRecipients) {
      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      `${r.full_name ?? ''} <${r.email}>`,
        subject: `📋 PMSI PreDoc Agenda — ${format(today, 'MMMM d, yyyy')} — 9:00 AM CST`,
        html:    pmsiHtml,
      })
    }
  }

  // Build IDEA internal agenda
  const ideaRecipients = await getRecipients(['predoc_idea'], ['idea_internal'])
  if (ideaDocs.length > 0 && ideaRecipients.length > 0) {
    const ideaHtml = buildAgendaEmail(ideaDocs, 'IDEA Internal PreDoc Review', 'After 9AM CST', today)
    for (const r of ideaRecipients) {
      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      `${r.full_name ?? ''} <${r.email}>`,
        subject: `📋 IDEA PreDoc Agenda — ${format(today, 'MMMM d, yyyy')}`,
        html:    ideaHtml,
      })
    }
  }

  // Build full FAC agenda (all docs)
  const facRecipients = await getRecipients(['fac_doc_rev'], ['pmsi','idea_internal'])
  if (facRecipients.length > 0) {
    const facHtml = buildAgendaEmail(docs, 'FAC Document Review', '2:30 PM CST', today)
    for (const r of facRecipients) {
      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      `${r.full_name ?? ''} <${r.email}>`,
        subject: `📋 FAC Agenda — ${format(today, 'MMMM d, yyyy')} — 2:30 PM CST`,
        html:    facHtml,
      })
    }
  }

  // Mark agenda as sent on meeting record
  if (meeting) {
    await supabase.from('meetings').update({
      agenda_generated_at: new Date().toISOString(),
      agenda_sent_at:      new Date().toISOString(),
    }).eq('id', meeting.id)
  }

  return {
    success: true,
    action:  'agenda_builder',
    docs:    docs.length,
    pmsi:    pmsiDocs.length,
    idea:    ideaDocs.length,
  }
}

function buildAgendaEmail(docs: any[], meetingTitle: string, time: string, date: Date): string {
  const dateStr = format(date, 'EEEE, MMMM d, yyyy')

  // Group by state
  const byState: Record<string, any[]> = {}
  docs.forEach(d => {
    const s = d.state ?? 'TX'
    if (!byState[s]) byState[s] = []
    byState[s].push(d)
  })

  const stateBlocks = Object.entries(byState).map(([state, stateDocs]) => {
    const rows = stateDocs.map((d, i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:11px;color:#9ca3af;">${i + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;">
          <div style="font-size:13px;font-weight:600;color:#111827;">${d.campus_name ?? '—'}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">${d.document_type_name ?? '—'}</div>
          ${d.vendor_name ? `<div style="font-size:11px;color:#9ca3af;">${d.vendor_name}</div>` : ''}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${d.presenter_name ?? '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-family:monospace;color:#1F4E79;font-weight:600;">${formatCurrency(d.amount)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${d.funding_source ?? '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;">
          ${d.file_status === 'pending_doc'
            ? '<span style="background:#fff7ed;color:#92400e;font-size:10px;font-weight:bold;padding:2px 8px;border-radius:12px;border:1px solid #fed7aa;">⏳ PENDING DOC</span>'
            : '<span style="background:#f0fdf4;color:#15803d;font-size:10px;font-weight:bold;padding:2px 8px;border-radius:12px;border:1px solid #bbf7d0;">✓ File Ready</span>'
          }
          ${d.is_urgent ? '<br><span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:bold;padding:2px 8px;border-radius:12px;margin-top:3px;display:inline-block;border:1px solid #fca5a5;">🔥 URGENT</span>' : ''}
        </td>
      </tr>
    `).join('')

    return `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:13px;font-weight:bold;color:#1F4E79;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px;padding:8px 12px;background:#eff6ff;border-radius:6px;">
          ${state} — ${stateDocs.length} item${stateDocs.length !== 1 ? 's' : ''} · ${formatCurrency(stateDocs.reduce((s, d) => s + (d.amount ?? 0), 0))}
        </h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#9ca3af;">#</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#9ca3af;">Campus / Project</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#9ca3af;">Presenter</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#9ca3af;">Amount</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#9ca3af;">Funding</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#9ca3af;">File Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `
  }).join('')

  const totalValue = docs.reduce((s, d) => s + (d.amount ?? 0), 0)
  const pendingCount = docs.filter(d => d.file_status === 'pending_doc').length

  return `
  <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#1a1a1a;">
    <div style="background:#1F4E79;padding:20px 24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:18px;">${meetingTitle}</h1>
      <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:13px;">${dateStr} · ${time}</p>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      
      <!-- Summary -->
      <div style="display:flex;gap:16px;margin-bottom:20px;">
        <div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#1F4E79;">${docs.length}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Total Items</div>
        </div>
        <div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#1F4E79;">${formatCurrency(totalValue)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Total Value</div>
        </div>
        ${pendingCount > 0 ? `
        <div style="flex:1;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#92400e;">${pendingCount}</div>
          <div style="font-size:11px;color:#92400e;margin-top:2px;">Pending Doc</div>
        </div>` : ''}
      </div>

      ${stateBlocks}

      <div style="margin-top:20px;text-align:center;">
        <a href="${APP_URL}/meetings/fac/live" style="display:inline-block;background:#F59E0B;color:#000;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;">
          Open Meeting Mode →
        </a>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#9ca3af;margin:12px 0 0;">
      Generated by F&C Command Center · Hope Built Advisory · ${format(new Date(), "h:mm a 'CST'")}
    </p>
  </div>`
}

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const { action } = await req.json().catch(() => ({ action: 'aging_refresh' }))

    let result: any

    switch (action) {
      case 'monday_reminder':  result = await mondayReminder();  break
      case 'deadline_check':   result = await deadlineCheck();   break
      case 'agenda_builder':   result = await agendaBuilder();   break
      case 'aging_refresh':    result = await refreshAging();    break
      default:
        result = { error: `Unknown action: ${action}` }
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
