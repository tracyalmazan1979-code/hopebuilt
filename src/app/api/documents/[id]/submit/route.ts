// ============================================================
// HOPE BUILT ADVISORY — Document Submission Email
// POST /api/documents/[id]/submit
//
// Fires when a PMSI document is submitted through the app.
// Sends formatted email to Vanessa + Sylvia CC + PMSI personnel CC.
// Sets file_status, records submission event.
//
// Also handles: Monday reminder, Tuesday deadline alert,
//   Wednesday pending-doc alert (called by Edge Function cron)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase-server'
import { format } from 'date-fns'
import type { Document } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY!)

// ── Email recipient config ────────────────────────────────────
// In production these come from the agenda_recipients table.
// Hardcoded here as fallback / seed values.

const VANESSA = { name: 'Vanessa Rangel',  email: 'vanessa.rangel@ideapublicschools.org' }
const SYLVIA  = { name: 'Sylvia Pena',     email: 'sylvia.pena@ideapublicschools.org'    }

// ── Email templates ───────────────────────────────────────────

function buildSubmissionEmail(doc: any, cafUrl: string | null) {
  const amount = doc.amount != null
    ? doc.amount < 0
      ? `($${Math.abs(doc.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })})`
      : `$${doc.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : 'N/A'

  const deadline = doc.submission_deadline
    ? format(new Date(doc.submission_deadline), "EEEE, MMMM d 'at' h:mm a 'CST'")
    : 'Tuesday 3:00 PM CST'

  const subject = [
    doc.state,
    doc.campus_name,
    doc.document_type_name,
    amount !== 'N/A' ? `— ${amount}` : '',
  ].filter(Boolean).join(' · ')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f4f4f4; }
    .wrapper { max-width: 640px; margin: 24px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1F4E79; padding: 20px 28px; }
    .header-title { color: #fff; font-size: 18px; font-weight: bold; margin: 0; }
    .header-sub { color: rgba(255,255,255,0.7); font-size: 12px; margin: 4px 0 0; }
    .body { padding: 24px 28px; }
    .section-label { font-size: 10px; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 6px; }
    .field-row { display: flex; margin-bottom: 12px; gap: 12px; }
    .field { flex: 1; }
    .field-label { font-size: 11px; color: #9ca3af; margin: 0 0 2px; }
    .field-value { font-size: 14px; color: #111827; font-weight: 500; margin: 0; }
    .field-value.amount { color: #1F4E79; font-weight: 700; font-size: 16px; }
    .field-value.urgent { color: #dc2626; font-weight: 700; }
    .description-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px; margin: 16px 0; }
    .description-text { font-size: 13px; color: #374151; line-height: 1.6; margin: 0; }
    .flags { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
    .flag { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .flag-urgent { background: #fee2e2; color: #991b1b; }
    .flag-bod { background: #ede9fe; color: #5b21b6; }
    .flag-legal { background: #fff7ed; color: #92400e; }
    .flag-coop { background: #ecfdf5; color: #065f46; }
    .flag-students { background: #fef3c7; color: #92400e; }
    .pending-doc-banner { background: #fff7ed; border: 2px solid #f59e0b; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
    .pending-doc-text { font-size: 13px; color: #92400e; margin: 0; font-weight: 600; }
    .cta-section { text-align: center; padding: 20px 0 0; }
    .cta-btn { display: inline-block; background: #1F4E79; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .deadline-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin: 16px 0; }
    .deadline-text { font-size: 12px; color: #15803d; margin: 0; }
    .footer { background: #f9fafb; padding: 16px 28px; border-top: 1px solid #e5e7eb; }
    .footer-text { font-size: 11px; color: #9ca3af; margin: 0; }
    .divider { height: 1px; background: #e5e7eb; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    .td-label { font-size: 11px; color: #9ca3af; width: 140px; padding-right: 12px; }
    .td-value { font-size: 13px; color: #111827; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <p class="header-title">📋 F&C Document Submission</p>
      <p class="header-sub">IDEA Facilities & Construction · ${doc.state} · ${format(new Date(), 'MMMM d, yyyy')}</p>
    </div>

    <div class="body">

      ${doc.is_urgent ? `
      <div class="pending-doc-banner" style="background:#fee2e2;border-color:#f87171;">
        <p class="pending-doc-text" style="color:#991b1b;">🔥 URGENT REQUEST — Date Needed: ${doc.date_needed_by ? format(new Date(doc.date_needed_by), 'MMMM d, yyyy') : 'See urgent reason'}</p>
        ${doc.urgent_reason ? `<p style="font-size:12px;color:#7f1d1d;margin:6px 0 0;">${doc.urgent_reason}</p>` : ''}
      </div>` : ''}

      ${doc.file_status === 'pending_doc' ? `
      <div class="pending-doc-banner">
        <p class="pending-doc-text">⏳ PENDING DOC — Document file not yet attached. Record submitted for tracking purposes. File to follow.</p>
      </div>` : ''}

      <p class="section-label">Document Details</p>

      <table>
        <tr>
          <td class="td-label">Campus / Project</td>
          <td class="td-value"><strong>${doc.campus_name ?? '—'}</strong></td>
        </tr>
        <tr>
          <td class="td-label">Document Type</td>
          <td class="td-value">${doc.document_type_name ?? '—'}</td>
        </tr>
        <tr>
          <td class="td-label">Requester</td>
          <td class="td-value">${[doc.requester_name, doc.requester_title].filter(Boolean).join(' · ') || doc.presenter_name || '—'}</td>
        </tr>
        <tr>
          <td class="td-label">Amount</td>
          <td class="td-value"><strong style="color:#1F4E79;font-size:15px;">${amount}</strong></td>
        </tr>
        <tr>
          <td class="td-label">Funding Source</td>
          <td class="td-value">${doc.funding_source ?? '—'}</td>
        </tr>
        ${doc.vendor_name ? `
        <tr>
          <td class="td-label">Vendor</td>
          <td class="td-value">${doc.vendor_name}${doc.is_coop_member ? ` · <span style="color:#065f46">CO-OP: ${doc.coop_name ?? 'Yes'}</span>` : ''}</td>
        </tr>` : ''}
        ${doc.service_start_date ? `
        <tr>
          <td class="td-label">Service Dates</td>
          <td class="td-value">${format(new Date(doc.service_start_date), 'MM/dd/yyyy')} → ${doc.service_end_date ? format(new Date(doc.service_end_date), 'MM/dd/yyyy') : 'TBD'}</td>
        </tr>` : ''}
        <tr>
          <td class="td-label">State / Org</td>
          <td class="td-value">${doc.state} · ${doc.organization ?? 'IDEA Public Schools Texas'}</td>
        </tr>
      </table>

      <div class="divider"></div>

      <p class="section-label">Description of Services</p>
      <div class="description-box">
        <p class="description-text">${doc.description ?? 'No description provided.'}</p>
      </div>

      ${doc.notes ? `
      <p class="section-label" style="margin-top:16px;">Submitter Notes</p>
      <div class="description-box" style="background:#eff6ff;border-color:#bfdbfe;">
        <p class="description-text" style="color:#1e40af;">${doc.notes}</p>
      </div>` : ''}

      <!-- Auto-detected flags -->
      <div class="flags">
        ${doc.is_urgent              ? '<span class="flag flag-urgent">🔥 Urgent</span>' : ''}
        ${doc.students_on_campus     ? '<span class="flag flag-students">⚠ Students On Campus</span>' : ''}
        ${doc.is_coop_member         ? `<span class="flag flag-coop">✓ CO-OP: ${doc.coop_name ?? 'Member'}</span>` : ''}
      </div>

      <div class="deadline-box">
        <p class="deadline-text">📅 <strong>FAC Submission Deadline:</strong> ${deadline} &nbsp;·&nbsp; <strong>FAC Meeting:</strong> Wednesday 2:30 PM CST</p>
      </div>

      ${cafUrl ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;margin:12px 0;">
        <p style="font-size:12px;color:#15803d;margin:0;">📄 <strong>CAF Form auto-generated</strong> · <a href="${cafUrl}" style="color:#15803d;">Download CAF PDF</a></p>
      </div>` : ''}

      ${process.env.NEXT_PUBLIC_APP_URL ? `
      <div class="cta-section">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/documents/${doc.id}" class="cta-btn">
          View in F&C Command Center →
        </a>
      </div>` : ''}

    </div>

    <div class="footer">
      <p class="footer-text">
        Submitted by ${doc.submitted_by_name ?? 'PMSI'} via F&C Command Center · Hope Built Advisory
        &nbsp;·&nbsp; ${format(new Date(), "MMM d, yyyy 'at' h:mm a 'CST'")}
      </p>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}

function buildPendingDocAlert(pendingDocs: any[]) {
  const list = pendingDocs.map(d =>
    `<li style="margin-bottom:8px;"><strong>${d.state} · ${d.campus_name}</strong> — ${d.document_type_name ?? 'Unknown type'} · Submitted by ${d.presenter_name ?? d.submitted_by_name ?? 'Unknown'}</li>`
  ).join('')

  return {
    subject: `⚠ ${pendingDocs.length} Pending Doc(s) — File Not Yet Received`,
    html: `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;padding:24px;max-width:600px;margin:0 auto;">
  <div style="background:#fff7ed;border:2px solid#f59e0b;border-radius:8px;padding:20px 24px;">
    <h2 style="color:#92400e;margin:0 0 8px;">⚠ Pending Document Alert</h2>
    <p style="color:#78350f;font-size:13px;margin:0 0 16px;">
      The following ${pendingDocs.length} item(s) are on the FAC tracker but no document file has been received yet.
      Tuesday 3:00 PM CST deadline has passed.
    </p>
    <ul style="color:#374151;font-size:13px;line-height:1.6;padding-left:20px;">
      ${list}
    </ul>
    <p style="font-size:12px;color:#92400e;margin:16px 0 0;">
      Please follow up with the submitter to receive the document file before Wednesday's PreDoc Review at 9:00 AM CST.
    </p>
  </div>
</body></html>`
  }
}

function buildMondayReminder(upcomingFACDate: string, recipientName: string) {
  return {
    subject: `📋 Reminder: F&C Submissions Due Tuesday 3 PM CST`,
    html: `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;padding:24px;max-width:600px;margin:0 auto;">
  <div style="background:#eff6ff;border:1px solid#bfdbfe;border-radius:8px;padding:20px 24px;">
    <h2 style="color:#1e40af;margin:0 0 8px;">📋 Weekly F&C Submission Reminder</h2>
    <p style="color:#1e40af;font-size:13px;margin:0 0 16px;">Hi ${recipientName},</p>
    <p style="color:#374151;font-size:13px;margin:0 0 12px;">
      This is your weekly reminder that all documents for the 
      <strong>${format(new Date(upcomingFACDate), 'MMMM d, yyyy')}</strong> FAC meeting
      are due to Vanessa by <strong>Tuesday 3:00 PM CST</strong>.
    </p>
    <p style="color:#374151;font-size:13px;margin:0 0 12px;">
      If a document isn't ready, please still submit the tracker record with all available information
      and note <strong>PENDING DOC</strong> so it appears on the agenda.
    </p>
    <p style="font-size:12px;color:#6b7280;margin:16px 0 0;">
      Wednesday schedule: PreDoc Review 9:00 AM · FAC Meeting 2:30 PM CST
    </p>
  </div>
</body></html>`
  }
}

// ── API Route: Submit Document ────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { file_status = 'pending_doc', pmsi_personnel_emails = [], pmsi_personnel_names = [] } = body

  // Fetch full document
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mark as submitted
  await supabase
    .from('documents')
    .update({
      submitted_at:              new Date().toISOString(),
      submitted_by_name:         doc.requester_name ?? doc.presenter_name,
      submission_channel:        'app_form',
      file_status,
      pmsi_personnel_emails,
      pmsi_personnel_names,
      submission_email_sent:     false,
    })
    .eq('id', params.id)

  // Build recipient list
  // TO: Vanessa
  // CC: Sylvia, all specified PMSI personnel
  const toRecipients  = [VANESSA]
  const ccRecipients  = [SYLVIA]

  if (pmsi_personnel_emails?.length) {
    pmsi_personnel_emails.forEach((email: string, i: number) => {
      ccRecipients.push({
        email,
        name: pmsi_personnel_names[i] ?? email.split('@')[0],
      })
    })
  }

  // Build + send email
  const { subject, html } = buildSubmissionEmail(doc as Document, doc.caf_pdf_url)

  const emailResult = await resend.emails.send({
    from:    'F&C Command Center <fac@hopebuiltadvisory.com>',
    to:      toRecipients.map(r => `${r.name} <${r.email}>`),
    cc:      ccRecipients.map(r => `${r.name} <${r.email}>`),
    subject,
    html,
    attachments: doc.caf_pdf_url ? [{ filename: `CAF_${doc.campus_name?.replace(/\s+/g, '_')}.pdf`, path: doc.caf_pdf_url }] : [],
    tags: [
      { name: 'type',   value: 'document_submission' },
      { name: 'org',    value: doc.org_id             },
      { name: 'state',  value: doc.state              },
    ],
  })

  // Log submission event
  await supabase.from('submission_events').insert({
    org_id:       doc.org_id,
    document_id:  doc.id,
    event_type:   'submitted',
    recipients:   [...toRecipients, ...ccRecipients].map(r => ({ ...r, role: toRecipients.includes(r) ? 'to' : 'cc' })),
    email_subject: subject,
    email_sent:    !emailResult.error,
    email_sent_at: emailResult.error ? null : new Date().toISOString(),
    notes:         file_status === 'pending_doc' ? 'Submitted as PENDING DOC — file not yet attached' : undefined,
  })

  // Mark email sent on document
  if (!emailResult.error) {
    await supabase
      .from('documents')
      .update({ submission_email_sent: true, submission_email_sent_at: new Date().toISOString() })
      .eq('id', params.id)
  }

  return NextResponse.json({
    success: true,
    email_sent: !emailResult.error,
    recipients: {
      to: toRecipients.map(r => r.email),
      cc: ccRecipients.map(r => r.email),
    },
    file_status,
    message: file_status === 'pending_doc'
      ? 'Document submitted as PENDING DOC. Vanessa has been notified. Attach the file when ready.'
      : 'Document submitted and email sent to Vanessa + team.',
  })
}

// ── Deadline Alert (called by Edge Function cron) ─────────────
// Exported so the cron function can call it directly

async function sendPendingDocAlert(supabase: ReturnType<typeof createClient>) {
  const { data: overdue } = await supabase
    .from('v_pending_docs')
    .select('*')
    .eq('is_past_deadline', true)
    .order('hours_past_deadline', { ascending: false })

  if (!overdue?.length) return { sent: false, reason: 'No overdue pending docs' }

  const { subject, html } = buildPendingDocAlert(overdue)

  const result = await resend.emails.send({
    from:    'F&C Command Center <fac@hopebuiltadvisory.com>',
    to:      [`${VANESSA.name} <${VANESSA.email}>`],
    cc:      [`${SYLVIA.name} <${SYLVIA.email}>`],
    subject,
    html,
    tags: [{ name: 'type', value: 'pending_doc_alert' }],
  })

  return { sent: !result.error, count: overdue.length }
}

// ── Monday Reminder (called by Edge Function cron) ────────────

async function sendMondayReminders(
  supabase: ReturnType<typeof createClient>,
  upcomingFACDate: string
) {
  const { data: recipients } = await supabase
    .from('agenda_recipients')
    .select('*')
    .eq('is_active', true)

  if (!recipients?.length) return

  const results = await Promise.allSettled(
    recipients.map(r => {
      const { subject, html } = buildMondayReminder(upcomingFACDate, r.full_name ?? r.email)
      return resend.emails.send({
        from:    'F&C Command Center <fac@hopebuiltadvisory.com>',
        to:      [`${r.full_name ?? ''} <${r.email}>`],
        subject,
        html,
        tags: [{ name: 'type', value: 'monday_reminder' }],
      })
    })
  )

  return { sent: results.filter(r => r.status === 'fulfilled').length, total: results.length }
}
